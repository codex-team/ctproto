import MessageFactory from '../messageFactory';
import { NewMessage, ResponseMessage } from '../../types';
import WebSocket, { MessageEvent, CloseEvent, ErrorEvent } from 'ws';

/**
 * Available options for the CTProtoClient
 *
 * @template AuthRequestPayload - data used for authorization
 * @template AuthResponsePayload - authorization response payload
 * @template Api
 */
export interface CTProtoClientOptions<AuthRequestPayload, AuthResponsePayload, ApiResponse extends ResponseMessage<unknown>> {
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
  onAuth: (payload: AuthResponsePayload) => void;

  /**
   * Method for handling message inited by the API
   * Will be called when API sends message  (<-- not a response)
   *
   * @param data - message payload
   */
  onMessage: (payload: ApiResponse['payload']) => void;

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
  cb?: RequestCallback<MessagePayload>;
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
export default class CTProtoClient<AuthRequestPayload, AuthResponsePayload, ApiRequest extends NewMessage<unknown>, ApiResponse extends ResponseMessage<unknown>> {
  /**
   * Instance of WebSocket
   */
  private readonly socket: WebSocket;

  /**
   * Configuration options passed on Transport initialization
   */
  private readonly options: CTProtoClientOptions<AuthRequestPayload, AuthResponsePayload, ApiResponse>;

  /**
   * Actual requests
   */
  private requests: Array<Request<ApiResponse['payload']>> = new Array<Request<ApiResponse['payload']>>();

  /**
   * Constructor
   *
   * @param options - Transport options
   */
  constructor(options: CTProtoClientOptions<AuthRequestPayload, AuthResponsePayload, ApiResponse>) {
    this.options = options;
    this.socket = new WebSocket(options.apiUrl);

    /**
     * Open connection event
     */
    this.socket.onopen = () => {
      /**
       * After open connection we send authorization message
       */
      this.send('authorize', this.options.authRequestPayload).then((responsePayload) => {
        this.options.onAuth(responsePayload as AuthResponsePayload);
      });
    };

    /**
     * Incoming message event
     *
     * @param event - message event
     */
    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const message: ApiResponse = JSON.parse(event.data.toString());
        const messageId = message.messageId;

        const request: Request<ApiRequest['payload']> | undefined = this.requests.find(req => req.messageId === messageId);

        /**
         * if messageId === null then this message inited by the API
         */
        if (messageId === null) {
          this.options.onMessage(message.payload);
        }

        /**
         * If we found requests and we have cb we do cb function
         */
        if (request && typeof request.cb == 'function') {
          request.cb(message.payload);
        }
      } catch (error) {
        this.log(`${error.message}`, event.data);
      }
    };

    /**
     * Connection closed event
     *
     * @param event - close event
     */
    this.socket.onclose = (event: CloseEvent) => {
      this.log('Connection closed: ', event.code);
    };

    /**
     * Error event
     *
     * @param event - error event
     */
    this.socket.onerror = (event: ErrorEvent) => {
      this.log('Error: ', event.message);
    };
  }

  /**
   * This method sends requests
   * When response comes callback function will be called
   *
   * @param type - type of requests
   * @param payload - any payload
   */
  public async send(type: ApiRequest['type'], payload: ApiRequest['payload']): Promise<ApiResponse['payload'] | AuthResponsePayload> {
    const message = MessageFactory.create(type, payload);

    /**
     * If readyState === CONNECTING then we wait for open connection
     */
    if (this.socket.readyState === this.socket.CONNECTING) {
      await this.waitForOpenConnection();
    }

    /**
     * If readyState === CLOSED then we throw error
     */
    if (this.socket.readyState === this.socket.CLOSED) {
      const prefix = 'CTProto 💖';

      throw new Error(`${prefix} Connection closed`);
    }

    this.socket.send(message);

    return new Promise(resolve => {
      this.requests.push({
        messageId: JSON.parse(message).messageId,
        cb: (response: ApiResponse['payload']) => {
          resolve(response);
        },
      });
    });
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
