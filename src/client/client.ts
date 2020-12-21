import MessageFactory from '../messageFactory';
import { ResponseMessage } from '../../types';
import WebSocket from 'ws';

/**
 * Available options for the CTProtoClient
 *
 *  @template MessagePayload - what kind of data passed with the message
 *  @template AuthRequestPayload - data used for authorization
 */
export interface CTProtoClientOptions<MessagePayload, AuthRequestPayload> {
  /**
   * Requests will be made to this API
   */
  apiUrl: string;

  /**
   * data used for authorization (for example: JWT token)
   */
  authRequestPayload: AuthRequestPayload;

  /**
   * Method for handling authorization response
   * Will be called when authorization response comes
   *
   * @param data - message payload
   */
  onAuth: (payload: MessagePayload) => Promise<void> | void;

  /**
   * Method for handling message inited by the API
   * Will be called when API sends message  (<-- not a response)
   *
   * @param data - message payload
   */
  onMessage: (payload: MessagePayload) => Promise<void> | void;

  /**
   * Allows disabling logs
   */
  disableLogs?: boolean;
}

/**
 * Storing requests
 * This is for catching responses to requests with messageId.
 *
 * @template MessagePayload - what kind of data passed with the message
 */
export interface Request<MessagePayload> {
  /**
   * Request message id
   */
  messageId: string;

  /**
   * Callback, which will called when response comes.
   *
   * @param data - message payload
   */
  cb?: (payload: MessagePayload) => Promise<void> | void;
}

/**
 * (￣^￣)ゞ
 *
 * Class Transport
 *
 * @template MessagePayload - what kind of data passed with the message
 * @template AuthRequestPayload - data used for authorization
 * @template ApiResponse - the type describing all available API response messages
 */
export default class CTProtoClient<MessagePayload, AuthRequestPayload, ApiResponse extends ResponseMessage<MessagePayload>> {
  /**
   * Instance of WebSocket
   */
  private readonly socket: WebSocket;

  /**
   * Configuration options passed on Transport initialization
   */
  private readonly options: CTProtoClientOptions<MessagePayload, AuthRequestPayload>;

  /**
   * Actual requests
   */
  private requests: Array<Request<MessagePayload>> = new Array<Request<MessagePayload>>();

  /**
   * Constructor
   *
   * @param options - Transport options
   */
  constructor(options: CTProtoClientOptions<MessagePayload, AuthRequestPayload>) {
    this.options = options;
    this.socket = new WebSocket(options.apiUrl);

    /**
     * Open connection event
     */
    this.socket.onopen = () => {
      /**
       * After open connection we send authorization message
       */
      this.send('authorize', this.options.authRequestPayload, this.options.onAuth);
    };

    /**
     * Incoming message event
     *
     * @param event - message event
     */
    this.socket.onmessage = (event) => {
      const message: ApiResponse = JSON.parse(event.data.toString());
      const messageId = message.messageId;

      /**
       * if messageId == null then this message inited by the API
       */
      if (messageId === null) {
        this.options.onMessage(message.payload);

        return;
      }

      const request: Request<MessagePayload> | undefined = this.requests.find(req => req.messageId === messageId);

      /**
       * If we found request and we have cb we do cb function
       */
      if (request && typeof request.cb == 'function') {
        request.cb(message.payload);
      }
    };

    /**
     * Connection closed event
     */
    this.socket.onclose = () => {
      this.log('Connection closed');
    };

    /**
     *  Error event
     */
    this.socket.onerror = () => {
      this.log('Error');
    };
  }

  /**
   * This method sends request
   * When response comes callback function will be called
   *
   * @param type - type of request
   * @param payload - any payload
   * @param cb - cb which will be called when response comes
   */
  public async send(type: string, payload: MessagePayload | AuthRequestPayload, cb?: (data: MessagePayload) => Promise<void> | void): Promise<void> {
    const message = MessageFactory.create(type, payload);

    this.requests.push({
      messageId: JSON.parse(message).messageId,
      cb,
    });

    if (this.socket.readyState === this.socket.CONNECTING){
      await this.waitForOpenConnection();
    }

    this.socket.send(message);
  }

  /**
   * Wait for open WebSocket connections
   */
  private async waitForOpenConnection(): Promise<void> {
    return new Promise((resolve) => {
      const intervalTime = 900;

      const interval = setInterval(() => {
        if (this.socket.readyState === this.socket.OPEN) {
          clearInterval(interval);
          resolve();
        }
      }, intervalTime);
    });
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
