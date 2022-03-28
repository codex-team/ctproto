import ws from 'ws';

import { CriticalError } from './errors';
import { CloseEventCode } from './closeEvent';
import Client from './client';
import { NewMessage, ResponseMessage } from '../../types';
import ClientsList from './clientsList';
import MessageFactory from './../messageFactory';
import MessageValidator from './messageValidator';
import { UploadedFile } from '../../types/file';
import { Buffer } from 'buffer';

/**
 * Available options for the CTProtoServer
 *
 * @template AuthRequestPayload - data used for authorization
 * @template AuthData - data got after authorization
 * @template ApiRequest - the type described all available API request messages
 * @template ApiResponse - the type described all available API response messages
 */
export interface CTProtoServerOptions<AuthRequestPayload, AuthData, ApiRequest, ApiResponse extends ResponseMessage<unknown>> extends ws.ServerOptions{
  /**
   * Allows overriding server host
   * @example '0.0.0.0'
   */
  host?: string;

  /**
   * Allows overriding server port
   * @example 8080
   */
  port?: number;

  /**
   * Allows overriding connection endpoint
   * @example '/api'
   */
  path?: string;

  /**
   * Method for socket authorization
   * Will be called when client will send the 'authorize' request.
   *
   * @param authRequestPayload - any app-related data for authorization.
   * @returns authorized client data
   */
  onAuth: (authRequestPayload: AuthRequestPayload) => AuthData | Promise<AuthData>;

  /**
   * Method for handling messages
   * Will be called on every message after authorization.
   *
   * @param message - full message data
   * @returns optionally can return any data to respond to client
   */
  onMessage: (message: ApiRequest) => Promise<void | ApiResponse['payload']>;

  /**
   * Allows to disable validation/authorization and other warning messages
   */
  disableLogs?: boolean;
}

/**
 * ヽ(͡◕ ͜ʖ ͡◕)ﾉ
 *
 * Class Transport (Transport level + Presentation level)
 *
 *
 * @todo strict connections only from /client route (@see https://stackoverflow.com/questions/22429744/how-to-setup-route-for-websocket-server-in-express)
 * @todo use Logger instead of console
 * @todo close broken connection ping-pong (https://github.com/websockets/ws#how-to-detect-and-close-broken-connections)
 * @todo implement the 'destroy()' method that will stop the server
 *
 * @template AuthRequestPayload - data used for authorization
 * @template AuthData - data got after authorization
 * @template ApiRequest - the type describing all available API request messages
 * @template ApiResponse - the type describing all available API response messages
 * @template ApiUpdate - all available outgoing messages
 */
export class CTProtoServer<AuthRequestPayload, AuthData, ApiRequest extends NewMessage<unknown>, ApiResponse extends ResponseMessage<unknown>, ApiUpdate extends NewMessage<unknown>> {
  /**
   * Manager of currently connected clients
   * Allows to find, send and other manipulations.
   */
  public clients = new ClientsList<AuthData, ApiResponse, ApiUpdate>();

  /**
   * Instance of transport-layer framework
   * In our case, this is a 'ws' server
   */
  private readonly wsServer: ws.Server;

  /**
   * Files which are uploading to the server at this time
   */
  private uploadedFiles: Array<UploadedFile>;

  /**
   * Configuration options passed on Transport initialization
   */
  private options: CTProtoServerOptions<AuthRequestPayload, AuthData, ApiRequest, ApiResponse>;

  /**
   * Constructor
   *
   * @param options - Transport options
   * @param WebSocketsServer - allows to override the 'ws' dependency. Used for mocking it in tests.
   */
  constructor(options: CTProtoServerOptions<AuthRequestPayload, AuthData, ApiRequest, ApiResponse>, WebSocketsServer?: ws.Server) {
    /**
     * Do not save clients in ws.clients property
     * because we will use own Map (this.ClientsList)
     */
    options.clientTracking = false;
    this.uploadedFiles = [];
    this.options = options;
    this.wsServer = WebSocketsServer || new ws.Server(this.options, () => {
      this.log(`Server is running at ws://${options.host || 'localhost'}:${options.port}`);
    });

    /**
     *  Client connects
     */
    this.wsServer.on('connection', (socket: ws) => {
      /**
       * We will close the socket if there is no messages for 3 seconds
       */
      let msgWaiter: NodeJS.Timeout;
      const msgWaitingTime = 3000;

      /**
       * Set type of incoming binary data to Buffer
       */
      socket.binaryType = 'nodebuffer';

      socket.on('message', (message: ws.Data) => {
        if (msgWaiter) {
          clearTimeout(msgWaiter);
        }

        this.onmessage(socket, message);
      });

      msgWaiter = setTimeout(() => {
        socket.close(CloseEventCode.TryAgainLater, 'Authorization required');
      }, msgWaitingTime);

      /**
       * Client disconnecting handler
       */
      socket.on('close', () => this.onclose(socket));

      /**
       * Sockets error handler
       */
      socket.on('error', () => this.onerror(socket));
    });
  }

  /**
   * Method for message event
   *
   * @param socket - socket
   * @param data - message data
   */
  private async onmessage(socket: ws, data: ws.Data): Promise<void> {

    this.parseIfString(data, socket);

    const client = this.clients.find((c) => c.socket === socket).current();

    try {
      if (client === undefined) {
        const message = JSON.parse(data as string);
        this.handleFirstMessage(socket, message);
      } else {
        if (data instanceof Buffer){
          this.handleBufferMessage(client, data)
        } else {
          const message = JSON.parse(data as string);
          this.handleAuthorizedMessage(client, message);
        }
      }
    } catch (error) {
      this.log(`Error while processing a message: ${(error as Error).message}`, data);
    }
  }

  /**
   * Method for string message
   *
   * @param socket - socket
   * @param data - message data
   */
  private async parseIfString(data: any, socket: ws): Promise<void> {
    if (typeof data === 'string') {
      try {
        MessageValidator.validateMessage(data as string);
      } catch (error) {
        const errorMessage = (error as Error).message;

        this.log(`Wrong message accepted: ${errorMessage} `, data);

        if (error instanceof CriticalError) {
          socket.close(CloseEventCode.UnsupportedData, errorMessage);
        } else {
          socket.send(MessageFactory.createError('Message Format Error: ' + errorMessage));
        }

        return;
      }
    }
  }

  /**
   * Process the first message:
   *  - check authorization
   *  - save client
   *
   * @param socket - socket of connected client
   * @param message - accepted message
   */
  private async handleFirstMessage(socket: ws, message: NewMessage<AuthRequestPayload>): Promise<void> {
    if (message.type !== 'authorize') {
      socket.close(CloseEventCode.PolicyViolation, 'Unauthorized');

      return;
    }

    try {
      const authData = await this.options.onAuth(message.payload);
      const clientToSave = new Client(socket, authData);

      this.clients.add(clientToSave);

      /**
       * Respond with success message and auth data
       */
      clientToSave.respond(message.messageId, authData);
    } catch (error) {
      socket.close(CloseEventCode.PolicyViolation, 'Authorization failed: ' + (error as Error).message);
    }
  }

  /**
   * Process not-first message.
   *
   * @param client - connected client
   * @param message - accepted message
   */
  private async handleAuthorizedMessage(client: Client<AuthData, ApiResponse, ApiUpdate>, message: ApiRequest): Promise<void> {
    if (message.type == 'authorize') {
      return;
    }

    try {
      const response = await this.options.onMessage(message);

      /**
       * Controller may not returning anything.
       */
      if (!response) {
        return;
      }

      /**
       * Respond with payload got from the onMessage handler
       */
      client.respond(message.messageId, response);
    } catch (error) {
      this.log('Internal error while processing a message: ', (error as Error).message);
    }
  }

  /**
   * Process not-first buffer message.
   *
   * @param client - connected client
   * @param message - accepted message
   */
  private async handleBufferMessage(client: Client<AuthData, ApiResponse, ApiUpdate>, message: Buffer): Promise<void> {
    /**
     * Parsing meta data from buffer message
     */
    const messageId = message.slice(0,10).toString();
    const fileId = message.slice(10,20).toString();
    const chunkNumber = (message.readInt8(20));

    let data;

    let dataSlice = 21;
    /**
     * Meta data of the first chunk includes additional information
     */
    if ( chunkNumber == 0 ) {
      const offsetForPayloadChunks = 21;

      const offsetForFileChunks = 22;

      /**
       * Create new file to upload
       */
      this.uploadedFiles.push( { id: fileId, file: [], payloadChunks: message.readInt8(offsetForPayloadChunks), chunks: message.readInt8(offsetForFileChunks)} );
      dataSlice = 23;
      data = message.slice(dataSlice);
    } else {
      data = message.slice(dataSlice);
    }

    const file = this.uploadedFiles.find((req) => req.id === fileId);
    if (file){
      /**
       * Pushes chunk to uploaded file
       */
      file.file.push(data)

      /**
       * Checks if payload data can be parsed
       */
      if ( chunkNumber == file.payloadChunks -1 ) {
        let payloadBuffer = new Buffer(0)
        for ( let payloadChunk of file.file.slice(0, file.payloadChunks) ) {
          payloadBuffer = Buffer.concat([payloadBuffer, payloadChunk])
        }
        let payload = payloadBuffer.toString();
        file.payload = JSON.parse(payload);
      }

      /**
       * Checks if file data can be parsed
       */
      if (file.file.length - file.payloadChunks == file.chunks){

        /**
         * Parsing only file data
         */
        if (file.file) {
          let fileChunks = file.file.slice(file.payloadChunks)
          let fileData = new Buffer(0);
          for (let chunk of fileChunks) {
            fileData = Buffer.concat([fileData, chunk]);
          }
        }
      }
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

  /**
   * Socket disconnection handler
   *
   * @param socket - disconnected socket
   */
  private onclose(socket: ws): void {
    this.clients.find((client) => client.socket === socket).remove();
  }

  /**
   * Handler for socket connection error
   *
   * @param socket - connected socket
   */
  private onerror(socket: ws): void {
    this.clients.find((client) => client.socket === socket).remove();
  }
}
