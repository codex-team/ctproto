import MessageFactory from '../messageFactory';
import { NewMessage, ResponseMessage } from '../../types';

/**
 * Available options for the CTProtoClient
 *
 * @template AuthRequestPayload - data used for authorization (for example: JWT token)
 * @template AuthResponsePayload - data got after authorization
 * @template ApiResponse - the type described all available API response messages
 */
export interface CTProtoClientOptions<AuthRequestPayload, AuthResponsePayload, ApiUpdate extends NewMessage<unknown>> {
  /**
   * Requests will be made to this API
   */
  apiUrl: string;

  /**
   * Authorization request payload
   */
  authRequestPayload: AuthRequestPayload;

  /**
   * Method for handling authorization response
   * Will be called when authorization response comes
   *
   * @param payload - authorization response payload
   */
  onAuth: (payload: AuthResponsePayload) => void;

  /**
   * Method for handling message initialized by the API
   * Will be called when API sends message  (<-- not a response)
   *
   * @param data - message initialized by the API
   */
  onMessage: (data: ApiUpdate) => void;

  /**
   * Allows disabling logs
   */
  disableLogs?: boolean;
}

/**
 * Callback, which will called when response comes
 *
 * @template MessagePayload - what kind of data passed with the message
 */
type RequestCallback<MessagePayload> = (payload: MessagePayload) => void;

/**
 * Storing requests
 * This is for catching responses to requests with messageId.
 *
 * @template MessagePayload - what kind of data passed with the message
 */
interface Request<MessagePayload> {
  /**
   * Request message id
   */
  messageId: string;

  /**
   * Callback, which will called when response comes.
   *
   * @param data - message payload
   */
  cb?: RequestCallback<MessagePayload>;
}

/**
 * Describing the file that is enqueued for uploading
 */
interface FileToUpload<MessagePayload> {
  /**
   * File id
   */
  id: string;

  /**
   * Chunks to send
   */
  chunks: Buffer;

  /**
   * Timeout id of resending chunks
   */
  responseWaitingTimeoutId?: NodeJS.Timeout;

  /**
   * Number of attempts to send a chunk
   */
  resendTimes: number;

  /**
   * The callback that will be called when the response will come.
   *
   * @param data - message payload
   */
  cb: RequestCallback<MessagePayload>;
}

/**
 * Message that is waiting for sending
 */
interface EnqueuedMessage<ApiRequest extends NewMessage<unknown>> {
  /**
   * What kind of message
   */
  type: ApiRequest['type'],

  /**
   * Data to send
   */
  payload: ApiRequest['payload'],

  /**
   * Callback with the promise resolving method
   */
  callback: RequestCallback<ApiRequest['payload']>
}

/**
 * Chunk Message that is waiting for sending
 */
interface EnqueuedChunkMessage {
  /**
   * Id of the sending file that contains the chunk
   */
  fileId: string,

  /**
   * Chunk number
   */
  chunkNumber: number,

  /**
   * Message to be passed with the chunk. JSON stringified.
   */
  message: string,
}

/**
 * (￣^￣)ゞ
 *
 * Class Transport
 *
 * @template AuthRequestPayload - data used for authorization
 * @template AuthResponsePayload - data got after authorization
 * @template ApiRequest - the type described all available API request messages
 * @template ApiResponse - the type described all available API response messages
 * @template ApiUpdate - the type described all available message initialized by the API
 */
export default class CTProtoClient<AuthRequestPayload, AuthResponsePayload, ApiRequest extends NewMessage<unknown>, ApiResponse extends ResponseMessage<unknown>, ApiUpdate extends NewMessage<unknown>> {
  /**
   * Instance of WebSocket
   */
  private socket?: WebSocket;

  /**
   * Configuration options passed on Transport initialization
   */
  private readonly options: CTProtoClientOptions<AuthRequestPayload, AuthResponsePayload, ApiUpdate>;

  /**
   * Actual requests
   */
  private requests: Array<Request<ApiResponse['payload']>> = new Array<Request<ApiResponse['payload']>>();

  /**
   * Messages that are waiting for sending
   * (for example, when the 'send' called before the connection is established)
   */
  private enqueuedMessages: Array<EnqueuedMessage<ApiRequest>> = [];

  /**
   * Buffer messages that are waiting for sending
   * (for example, when the 'send' called before the connection is established)
   */
  private enqueuedBufferMessages: Array<EnqueuedChunkMessage> = [];

  /**
   * Files which are uploading at the moment
   */
  private uploadingFiles: Array<FileToUpload<ApiResponse['payload']>> = new Array<FileToUpload<ApiResponse['payload']>>();

  /**
   * Limit for the chunk size in bytes
   */
  private readonly bufferLimit = 10000;

  /**
   * Reconnection tries Timeout
   */
  private reconnectionTimer: unknown;

  /**
   * Time between reconnection attempts
   */
  private readonly reconnectionTimeout = 5000;

  /**
   * How many time we should attempt reconnection
   */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  private reconnectionAttempts = 5;

  /**
   * Time between chunk sending attempts
   */
  private readonly chunkResendingTimeout = 5000;

  /**
   * Constructor
   *
   * @param options - Transport options
   */
  constructor(options: CTProtoClientOptions<AuthRequestPayload, AuthResponsePayload, ApiUpdate>) {
    this.options = options;

    this.init();
  }

  /**
   * This method sends file requests
   *
   * @param type - available type of requests
   * @param file - file to send
   * @param payload - available request payload
   */
  public async sendFile(
    type: ApiRequest['type'],
    file: Buffer,
    payload: ApiRequest['payload']

  ): Promise<ApiResponse['payload']> {
    return new Promise( resolve => {
      const callback = (response: ApiResponse['payload']): void => {
        resolve(response);
      };

      const fileId = MessageFactory.createFileId();

      const fileSize = file.length;

      /**
       * Calculate number of chunks
       */
      const chunks = this.calculateChunksNumber(file);

      /**
       * Create new uploading file to save data for file uploading
       */
      this.uploadingFiles.push({
        id: fileId,
        chunks: file,
        cb: callback,
        resendTimes: 0,
      });

      const message = MessageFactory.createMessageForChunk(type, payload, chunks, fileSize);

      const chunkNumber = 0;

      this.sendChunk( message, fileId, chunkNumber );
    });
  }


  /**
   * This method sends one chunk of the uploading file
   *
   * @param message - additional info for chunk
   * @param fileId - id of sending file
   * @param chunkNumber - number of sending chunk
   */
  private sendChunk(message: string, fileId: string, chunkNumber: number): void {
    const uploadingFile = this.getUploadingFileById(fileId);

    if (!uploadingFile) {

      throw new Error('File ' + fileId + ' has not found')
    }

    /**
     * Getting chunk by slicing file by the chunk number and buffer limit
     */
    const chunk = uploadingFile.chunks.slice( chunkNumber * this.bufferLimit, this.bufferLimit + this.bufferLimit * chunkNumber );

    /**
     * Getting additional info ( meta data ) converted to binary type, which includes info about chunk number and chunk size
     */
    const meta = this.makeMetaData(chunkNumber, chunk.length);

    /**
     * Unite meta with file data
     */
    const data = Buffer.concat([meta, chunk]);

    /**
     * If there are more then 5 attempts to send chunk, remove uploading file
     */
    if ( uploadingFile.resendTimes > this.reconnectionAttempts ) {
      /**
       * Remove uploading file
       */
      this.uploadingFiles.splice(this.uploadingFiles.indexOf(uploadingFile), 1);

      throw new Error('There is no response from server to ' + uploadingFile.resendTimes + ' attempts to send chunk')
    }

    const bufferMessage = MessageFactory.packChunk(fileId, data, message);

    if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
      this.enqueuedBufferMessages.push({
        fileId: fileId,
        chunkNumber: chunkNumber,
        message: message,
      });
    } else {
      this.socket.send(bufferMessage);

      /**
       * Create timeout, which will work in case of no respond from server
       */
      uploadingFile.responseWaitingTimeoutId = setTimeout( () => {
        this.sendChunk(message, fileId, chunkNumber);

        uploadingFile.resendTimes++;
      }, this.chunkResendingTimeout );
    }
  }

  /**
   * This method sends requests
   * When response comes callback function will be called
   *
   * @param type - available type of requests
   * @param payload - available request payload
   * @param [callback] - already created callback in case of sending the enqueued message
   */
  public async send(
    type: ApiRequest['type'],
    payload: ApiRequest['payload'],
    callback?: RequestCallback<ApiRequest['payload']>
  ): Promise<ApiResponse['payload'] | AuthResponsePayload> {
    return new Promise(resolve => {
      /**
       * If we are sending a message form the queue, there will be previously created callback
       * Otherwise, create the new callback
       */
      if (!callback) {
        callback = (response: ApiResponse['payload']): void => {
          resolve(response);
        };
      }

      const message = MessageFactory.create(type, payload);

      /**
       * Handle sending when connection is not opened
       */
      if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
        this.log(`Cannot send a message «${type}» for now because the connection is not opened. Enqueueing...`);
        this.enqueuedMessages.push({
          type,
          payload,
          callback,
        });

        /**
         * Do not initialize reconnection if there is CONNECTING or CLOSING state
         */
        if (this.socket && this.socket.readyState == this.socket.CLOSED) {
          this.reconnect();
        }

        return;
      }

      this.socket.send(message);
      this.requests.push({
        messageId: JSON.parse(message).messageId,
        cb: callback,
      });
    });
  }

  /**
   * Handle chunk response from server
   *
   * @param fileId - uploading file id
   * @param chunkNumber - file chunk number, which handled on server
   */
  private onChunkResponseMessage( fileId: string, chunkNumber: number ): void {
    const uploadingFile = this.getUploadingFileById( fileId );

    if (!uploadingFile) {
      throw new Error('File ' + fileId + 'has not found');
    }

    /**
     * Make log about loading progress
     */

    const percentMultiplier = 100;
    const percent = Math.floor(chunkNumber / Math.ceil(uploadingFile.chunks.length / this.bufferLimit) * percentMultiplier);

    this.log('File ' + fileId + ' uploaded on ' + percent + '%');

    uploadingFile.resendTimes = 0;

    /**
     * Clear resend timeout, because chunk is uploaded
     */
    if (uploadingFile.responseWaitingTimeoutId) {
      clearTimeout(uploadingFile.responseWaitingTimeoutId);
    }

    this.sendChunk(MessageFactory.createMessageForChunk(), fileId, chunkNumber + 1);
  }

  /**
   * This method returns file by file id
   *
   * @param fileId - file id of file to find
   */
  private getUploadingFileById(fileId: string): undefined | FileToUpload<ApiResponse['payload']> {
    return this.uploadingFiles.find((req) => req.id === fileId);
  }

  /**
   * This method calculate number of sending file chunks
   *
   * @param file - file to send
   */
  private calculateChunksNumber(file: Buffer): number {
    return Math.ceil(file.length / this.bufferLimit);
  }

  /**
   * Create meta data for chunk, in this case it includes number of sending chunk and size of file data
   *
   * @param chunkNumber - number of sending chunk
   * @param size - length of file data in chunk
   */
  private makeMetaData(chunkNumber: number, size: number): Buffer {
    const sizeForMetaData = 4;

    const bufferChunkNumber = Buffer.alloc(sizeForMetaData);

    bufferChunkNumber.writeInt32BE(chunkNumber);

    const bufferSize = Buffer.alloc(sizeForMetaData);

    bufferSize.writeInt32BE(size);

    return Buffer.concat([bufferChunkNumber, bufferSize]);
  }

  /**
   * Create socket instance and open the connections
   */
  private init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.options.apiUrl);

      /**
       * Incoming messages handler
       *
       * @param event - message event
       */
      this.socket.onmessage = (event: MessageEvent): void => {
        this.onMessage(event);
      };

      /**
       * Connection closing handler
       *
       * @param event - websocket event on closing
       */
      this.socket.onclose = (event: CloseEvent): void => {
        const { code, reason } = event;

        this.log('Connection closed: ', {
          code,
          reason,
        });
      };

      /**
       * Error handler
       *
       * @param event - error event
       */
      this.socket.onerror = (event: Event): void => {
        this.log('Socket error: ', event);

        reject(event);
      };

      /**
       * Socket opening handler
       */
      this.socket.onopen = (): void => {
        /**
         * After open connection we send authorization message
         */
        this.send('authorize', this.options.authRequestPayload)
          .then((responsePayload) => {
            this.log('the connection is ready for work');

            this.options.onAuth(responsePayload as AuthResponsePayload);

            if (this.enqueuedMessages.length > 0) {
              const len = this.enqueuedMessages.length;

              this.log(`There ${len === 1 ? 'is a message' : 'are ' + len + ' messages'} in queue:`, this.enqueuedMessages.map(m => m.type));

              this.sendEnqueuedMessages();
            }

            if (this.enqueuedBufferMessages.length > 0) {
              const len = this.enqueuedBufferMessages.length;

              this.log(`There ${len === 1 ? 'is a uploading file' : 'are ' + len + ' uploading files'} in queue`);

              this.sendEnqueuedBufferMessages();
            }

            resolve();
          });
      };
    });
  }

  /**
   * Incoming messages handler
   *
   * @param event - socket message event
   */
  private onMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data.toString());
      const messageId = message.messageId;
      const payload = message.payload;

      if ('fileId' in payload) {
        this.onChunkResponseMessage( payload.fileId, payload.chunkNumber );
      } else if ('type' in message) {
        this.options.onMessage(message);
      }

      const request: Request<ApiRequest['payload']> | undefined = this.requests.find(req => req.messageId === messageId);

      const file = this.getUploadingFileById(messageId);

      if (file) {
        file.cb(message.payload);
        if (file.responseWaitingTimeoutId) {
          clearTimeout( file.responseWaitingTimeoutId );
        }
        this.uploadingFiles.splice(this.uploadingFiles.indexOf(file), 1);
      }

      /**
       * If we found requests and we have cb we do cb function
       */
      if (request && typeof request.cb == 'function') {
        request.cb(message.payload);
      }
    } catch (error) {
      this.log(`${(error as Error).message}`, event.data);
    }
  }

  /**
   * Send all the enqueued messaged
   */
  private sendEnqueuedMessages(): void {
    while (this.enqueuedMessages.length > 0) {
      const messageToSend = this.enqueuedMessages.shift();

      if (messageToSend) {
        this.send(messageToSend['type'], messageToSend['payload'], messageToSend['callback']);
      }
    }
  }

  /**
   * Send all the enqueued buffer messages
   */
  private sendEnqueuedBufferMessages(): void {
    while (this.enqueuedBufferMessages.length > 0) {
      const enqueuedChunk= this.enqueuedBufferMessages.shift();

      if ( !enqueuedChunk ) {
        return;
      }

      const file = this.getUploadingFileById(enqueuedChunk.fileId);

      if (file ) {
        this.sendChunk( enqueuedChunk.message, enqueuedChunk.fileId, enqueuedChunk.chunkNumber );
      }
    }
  }

  /**
   * Tries to reconnect to the server for specified number of times with the interval
   *
   * @param {boolean} [isForcedCall] - call function despite on timer
   * @returns {Promise<void>}
   */
  private async reconnect(isForcedCall = false): Promise<void> {
    if (this.reconnectionTimer && !isForcedCall) {
      return;
    }

    this.reconnectionTimer = null;

    try {
      this.log('reconnecting...');

      await this.init();

      this.log('successfully reconnected.');
    } catch (error) {
      /**
       * In case of connection error (something goes wrong on server)
       * wait for 5 sec and try again
       */
      this.reconnectionAttempts--;

      if (this.reconnectionAttempts === 0) {
        return;
      }

      this.reconnectionTimer = setTimeout(() => {
        this.reconnect(true);
      }, this.reconnectionTimeout);
    }
  }

  /**
   * Log some string
   *
   * @param text - what to log
   * @param context - additional data to log
   */
  private log(text: string, context?: unknown): void {
    const prefix = 'CTProto 💖';

    if (this.options.disableLogs) {
      return;
    }

    if (context === undefined) {
      console.log(`${prefix} ${text}`);
    } else {
      console.log(`${prefix} ${text}`, context);
    }
  }
}
