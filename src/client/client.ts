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
 * Files to upload
 */
interface FileToUpload<MessagePayload> {
  /**
   * File id
   */
  id: string;

  /**
   * Chunks to send
   */
  chunks: Array<Buffer>;

  /**
   * The callback that will be called when the response will come.
   *
   * @param data - message payload
   */
  cb?: RequestCallback<MessagePayload>;
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
   * File if
   */
  fileId: string,

  /**
   * Chunk number
   */
  chunkNumber: number,

  /**
   * Chunk message
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
   * Limit for the chunk size at bytes
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
   * @param [callback] - already created callback in case of sending the enqueued message
   */
  public async sendFile(
    type: ApiRequest['type'],
    file: Buffer,
    payload: ApiRequest['payload'],
    callback?: RequestCallback<ApiRequest['payload']>
  ): Promise<ApiResponse['payload']> {
    return new Promise( resolve => {

      if (!callback) {
        callback = (response: ApiResponse['payload']) => {
          resolve(response);
        };
      }

      const fileId = MessageFactory.createFileId();

      const fileSize = file.length;

      /**
       * Calculate number of chunks
       */
      const chunks = Math.ceil(file.length / this.bufferLimit);

      /**
       * Cycle, which sends chunks
       */
      for (let i = 0; i < chunks; i++) {
        const uploadingFile = this.getUploadingFileById(fileId);
        const chunk = file.slice(i * this.bufferLimit, this.bufferLimit + this.bufferLimit * i);

        /**
         * The first chunk contains client payload info and on the first chunk creates new instance in uploadingFiles
         */
        if (!uploadingFile) {
          const message = MessageFactory.createForUpload(type, payload, chunks, fileSize);

          /**
           * Creates new instance of the uploading file to save file info in cases to handle responses and to check correct uploading
           */
          this.uploadingFiles.push({ id: fileId,
            chunks: [ chunk ],
            cb: callback,
          });
          this.sendChunk(chunk, i, message, fileId);
        } else {
          const message = MessageFactory.createMessageForChunk();

          /**
           * Push chunk to uploading files
           */
          uploadingFile!.chunks.push(chunk);
          this.sendChunk(chunk, i, message, fileId);
        }
      }
    });
  }


  /**
   * This method sends one chunk of the uploading file
   *
   * @param chunk - chunk with chunk data
   * @param chunkNumber - number of the chunk
   * @param message - additional info for chunk
   * @param fileId - id of sending file
   */
  public sendChunk(chunk: Buffer, chunkNumber: number, message: string, fileId: string): void {

      /**
       * Create meta data for chunk, in this case it includes number of sending chunk and size of file data
       */
      const sizeForMeta = 4;

      const bufferChunkNumber = Buffer.alloc(sizeForMeta);

      bufferChunkNumber.writeInt32BE(chunkNumber!);

      const bufferSize = Buffer.alloc(sizeForMeta);

      bufferSize.writeInt32BE(chunk.length);

      /**
       * Unite meta with file data
       */
      const data = Buffer.concat([bufferChunkNumber, bufferSize, chunk]);

      let bufferMessage = MessageFactory.packChunk(fileId, data, message);

      if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
       this.enqueuedBufferMessages.push({ fileId: fileId,
                                          chunkNumber: chunkNumber,
                                          message: message});
      } else {
       this.socket?.send(bufferMessage);
      }
  }

  /**
   * This method returns file by file id
   *
   * @param fileId - file id of file to find
   */
  private getUploadingFileById(fileId: string): undefined | FileToUpload<ApiResponse> {
    return this.uploadingFiles.find((req) => req.id === fileId);
  };

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
        callback = (response: ApiResponse['payload']) => {
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
        this.log('File ' + message.payload.fileId + ' Chunk uploaded: ' + message.payload.chunkNumber);
      } else if ('type' in message) {
        this.options.onMessage(message);
      }

      const request: Request<ApiRequest['payload']> | undefined = this.requests.find(req => req.messageId === messageId);

      const file = this.uploadingFiles.find(req => req.id === messageId);

      if (file && typeof file.cb == 'function') {
        file.cb(message.payload);
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

      const file = this.getUploadingFileById(enqueuedChunk!.fileId)

      if (file ) {
        this.sendChunk(file.chunks[enqueuedChunk!.chunkNumber], enqueuedChunk!.chunkNumber, enqueuedChunk!.message, enqueuedChunk!.fileId);
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
