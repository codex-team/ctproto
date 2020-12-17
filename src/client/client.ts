import MessageFactory from '../messageFactory';
import {NewMessage, ResponseMessage} from '../../types';

/**
 * Available options for the CTProtoClient
 *
 *  @template AuthRequestPayload - data used for authorization
 *  @template ApiResponse - the type described all available API response messages
 */
export interface CTProtoClientOptions<AuthRequestPayload, ApiResponse extends ResponseMessage<unknown>>{
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
   * @param data - full message data
   */
  onAuth: (data: ApiResponse) => Promise<void>;

  /**
   * Method for handling message inited by the API
   * Will be called when API sends message  (<-- not a response)
   *
   * @param message - full message data
   */
  onMessage: (data: ApiResponse) => Promise<void>;

  /**
   * Allows to disable validation/authorization and other warning messages
   */
  disableLogs?: boolean;
}

/**
 * Storing requests
 * This is for catching responses to requests with messageId.
 *
 * @template ApiRequest - the type described all available API request messages
 * @template ApiResponse - the type described all available API response messages
 */
export interface Request<ApiRequest, ApiResponse extends ResponseMessage<unknown>> {
  /**
   * Request
   */
  request: ApiRequest;

  /**
   * Callback, which will called when response comes.
   *
   * @param data - response
   */
  cb: (data: ApiResponse) => Promise<void>;
}

/**
 * Class Transport
 *
 * @template AuthRequestPayload - data used for authorization
 * @template ApiRequest - the type describing all available API request messages
 * @template ApiResponse - the type describing all available API response messages
 */
export default class CTProtoClient<AuthRequestPayload, ApiRequest extends NewMessage<unknown>, ApiResponse extends ResponseMessage<unknown>> {
  /**
   * Instance of WebSocket
   */
  private readonly socket: WebSocket;

  /**
   * Configuration options passed on Transport initialization
   */
  private readonly options: CTProtoClientOptions<AuthRequestPayload, ApiResponse>;

  /**
   * Actual requests
   */
  private requests: Array<Request<ApiRequest, ApiResponse>> = new Array<Request<ApiRequest, ApiResponse>>();

  /**
   * Constructor
   *
   * @param options - Transport options
   */
  constructor(options: CTProtoClientOptions<AuthRequestPayload, ApiResponse>) {
    this.options = options;
    this.socket = new WebSocket(options.apiUrl);

    /**
     * After open connection we send authorization message
     */
    this.socket.onopen = ev => {
      this.send('authorize', this.options.authRequestPayload, this.options.onAuth);
    };

    this.socket.onmessage = ev => {
      const message: ApiResponse = JSON.parse(ev.data);
      const messageId = message.messageId;

      /**
       * if messageId == null then this message inited by the API
       */
      if (messageId == null) {
        this.options.onMessage(message);

        return;
      }

      const req: Request<ApiRequest, ApiResponse> | undefined = this.requests.find(req => req.request.messageId === messageId);

      /**
       * If we found request we do cb function
       */
      if (!!req){
        req.cb(message);
      }
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
  public send(type: string, payload: AuthRequestPayload, cb: (data: ApiResponse) => Promise<void>): void {
    const message = MessageFactory.create(type, payload);

    this.requests.push({
      request: JSON.parse(message),
      cb,
    });

    this.socket.send(message);
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
