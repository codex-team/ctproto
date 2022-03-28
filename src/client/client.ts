import MessageFactory from '../messageFactory';
import { Message, NewMessage, ResponseMessage } from '../../types';

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
interface FileToPayload {
  /**
   * File id
   */
  id: string;

  /**
   * Chunks to send
   */
  chunks: Array<Buffer>;
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
   * Uploading files
   */
  private filesToUpload: Array<FileToPayload> = [];

  /**
   * Limit for chunk size
   */
  private readonly bufferLimit = 50;

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
   */
  public async sendFile(
    type: ApiRequest['type'],
    file: Buffer,
    payload: ApiRequest['payload'],
  ): Promise<ApiResponse['payload']> {
    return new Promise( resolve => {

      let metaLength = 21;

      /**
       * Space for data chunk without meta
       */
      let spaceForFrame = this.bufferLimit-metaLength;

      const fileId = MessageFactory.createMessageId();

      let chunks = this.calculateChunkNumber(file.length, spaceForFrame);

      /**
       * Creates message file payload
       */
      const message = MessageFactory.create(type, payload);
      const bufMessage = Buffer.from(message);

      /**
       * Calculate number of chunks, which include payload information
       */
      const payloadChunks = Math.ceil((bufMessage.length+2)/(spaceForFrame));

      /**
       * Create 3 bytes for meta data in the first chunk ( chunk number, number of payload chunks and number of file chunks )
       */
      let meta = this.createBufferForMeta(0, payloadChunks, chunks);

      /**
       * Creates buffer message to send
       */
      const firstChunk = MessageFactory.createBufferMessage(fileId, meta, bufMessage.slice(0, spaceForFrame-2));

      /**
       * Added new file to upload
       */
      this.filesToUpload.push({ id: fileId,
        chunks: [firstChunk]});

      if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
        this.log(`Cannot send a message «${type}» for now because the connection is not opened. Enqueueing...`);
      } else {
        this.socket?.send(firstChunk);
      }

      this.sendPayloadChunks(payloadChunks, spaceForFrame, bufMessage, fileId);

      this.sendFileChunks(chunks, spaceForFrame, file, payloadChunks, fileId);
    })
  }


  /**
   * Send file data chunks
   *
   * @param chunks - number of file chunks
   * @param spaceForFrame - space for file data in chunk
   * @param file - file to send
   * @param payloadChunks - number of chunks for payload message
   * @param fileId - id of sending file
   */
  public sendFileChunks(chunks: number, spaceForFrame: number, file: Buffer, payloadChunks: number, fileId: string): void{
    /**
     * Cycle, which sends file chunks
     */
    for (let i = 0; i<chunks; i++) {
      let size = spaceForFrame;

      /**
       * Calculate the remaining amount of file data
       */
      const ost = file.length - spaceForFrame * i;

      if (ost < spaceForFrame) {
        size = ost;
      }

      /**
       * Creates meta data ( chunk number )
       */
      let meta = this.createBufferForMeta(i+payloadChunks)

      /**
       * Creates buffer message to send
       */
      const chunk = MessageFactory.createBufferMessage(fileId, meta, file.slice(spaceForFrame * i, spaceForFrame * i + size));

      const uploadingFile = this.filesToUpload.find(( req ) => req.id === fileId);

      /**
       * Pushes chunk to uploaded file
       */
      uploadingFile!.chunks.push(chunk);

      if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
        this.log(`Cannot send a message for now because the connection is not opened. Enqueueing...`);
      } else {
        this.socket?.send(chunk);
      }
    }
  }

  /**
   * Send payload info chunks
   *
   * @param payloadChunks - number of chunks in payload
   * @param spaceForFrame - space for payload data in chunk
   * @param bufMessage - payload message to send
   * @param fileId - id of sending file
   */
  public sendPayloadChunks(payloadChunks: number, spaceForFrame: number, bufMessage: Buffer, fileId: string): void{
    const uploadingFile = this.filesToUpload.find((req) => req.id === fileId);

    /**
     * Cycle, which sends payload chunks
     */
    for (let i = 1; i<payloadChunks; i++) {

      let size = spaceForFrame;

      /**
       * Calculate the remaining amount of payload data
       */
      const remain = bufMessage.length + 2  - spaceForFrame*i;

      if (remain < spaceForFrame) {
        size = remain
      }

      /**
       * Creates meta data ( chunk number )
       */
      let meta = this.createBufferForMeta(i)

      /**
       * Creates buffer message to send
       */
      const chunk = MessageFactory.createBufferMessage(fileId, meta, bufMessage.slice(spaceForFrame*i -2, spaceForFrame * i + size -2 ));

      /**
       * Pushes chunk to uploaded file
       */
      uploadingFile!.chunks.push(chunk);
      if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
        this.log(`Cannot send a message for now because the connection is not opened. Enqueueing...`);
      } else {
        this.socket?.send(chunk);
      }

    }
  }

  /**
   * Create buffer for additional data in chunk
   *
   * @param args - some meta data in chunk
   */
  public createBufferForMeta(...args: number[]): Buffer {
    let unit = new Buffer(args.length);
    let i = 0;
    for (let arg of args){
      unit.writeInt8(arg, i);
      i++;
    }
    return unit;
  }


  /**
   * Calculate chunk number of file
   *
   * @param fileLength - file length
   * @param spaceForFrame - space for file data in chunk
   */
  public calculateChunkNumber(fileLength: number, spaceForFrame: number): number{
    if (fileLength > this.bufferLimit) {
      return Math.ceil((fileLength)/spaceForFrame);
    } else {
      return 1;
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

      if ('type' in message) {
        this.options.onMessage(message);
      }

      const request: Request<ApiRequest['payload']> | undefined = this.requests.find(req => req.messageId === messageId);

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
