import ws from 'ws';

import { CriticalError } from './errors';
import { CloseEventCode } from './closeEvent';
import Client from './client';
import { NewMessage, ResponseMessage } from '../../types';
import ClientsList from './clientsList';
import MessageFactory from './../messageFactory';
import MessageValidator from './messageValidator';
import { UploadingFile } from '../../types/file';
import { Buffer } from 'buffer';
import { ApiFileRequest } from '../../example/types';

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
   *
   * @example '0.0.0.0'
   */
  host?: string;

  /**
   * Allows overriding server port
   *
   * @example 8080
   */
  port?: number;

  /**
   * Allows overriding connection endpoint
   *
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
  onMessage: (message: ApiRequest | ApiFileRequest) => Promise<void | ApiResponse['payload']>;

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
  private uploadingFiles: Array<UploadingFile>;

  /**
   * Configuration options passed on Transport initialization
   */
  private readonly options: CTProtoServerOptions<AuthRequestPayload, AuthData, ApiRequest, ApiResponse>;

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
    this.uploadingFiles = [];
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
       * Set type of incoming binary data to Buffer, because client uses buffer type of binary data
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
    await this.validateTextMessage(data, socket);

    const client = this.clients.find((c) => c.socket === socket).current();

    try {
      if (client === undefined) {
        const message = JSON.parse(data as string);

        await this.handleFirstMessage(socket, message);
      } else {
        if (data instanceof Buffer) {
          await this.handleBufferMessage(client, data);
        } else {
          const message = JSON.parse(data as string);

          await this.handleAuthorizedMessage(client, message);
        }
      }
    } catch (error) {
      this.log(`Error while processing a message: ${(error as Error).message}`, data);
    }
  }

  /**
   * Method for string message
   *
   * @param data - message data
   * @param socket - socket
   */
  private async validateTextMessage(data: unknown, socket: ws): Promise<void> {
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
   * Process buffer message.
   *
   * @param client - connected client
   * @param message - accepted message
   */
  private async handleBufferMessage(client: Client<AuthData, ApiResponse, ApiUpdate>, message: Buffer): Promise<void> {
    /**
     * Parsing meta data from buffer message
     */
    const fileIdLength = 10;
    const chunkNumberOffset = 10;
    const sizeOffset = 14;

    const fileId = message.slice(0, fileIdSlice).toString();
    const chunkNumber = message.readInt32BE(chunkNumberOffset);
    const size = message.readInt32BE(sizeOffset);

    /**
     * Getting file data
     */
    const dataSlice = 18;
    const fileChunk = message.slice(dataSlice, dataSlice+size);

    /**
     * Parsing payload message in buffer message
     */
    const strPayload = message.slice(dataSlice + size).toString();

    const payload = JSON.parse(strPayload);

    let file = this.uploadingFiles.find((req) => req.id === fileId);

    /**
     * Meta data of the first chunk includes additional information
     */
    if ( chunkNumber === 0 ) {
      /**
       * Create Buffer for file data
       */
      const fileData = Buffer.alloc(payload.fileSize, 0);

      fileChunk.copy(fileData, 0);

      /**
       * Create new file object
       */
      this.uploadingFiles.push( { id: fileId,
        uploadedChunksCount: 1,
        file: fileData,
        chunks: payload.chunks,
        payload: payload.payload,
        type: payload.type,
        bufferLimit: size,
      } );

      file = this.uploadingFiles.find((req) => req.id === fileId);
    } else {
      if (file) {
        /**
         * Push file data
         */
        fileChunk.copy(file.file, file.bufferLimit * chunkNumber);

        file.uploadedChunksCount = file.uploadedChunksCount + 1;
      }
    }

    /**
     * Check if chunks in uploading file objects consists, and then check fullness
     */
    if (file?.chunks) {
      /**
       * Respond uploading info
       */
      client.respond(payload.id, { 
        chunkNumber: chunkNumber,
        type: file?.type,
        fileId: fileId,
      });

      /**
       * Check and parse if file is fully uploaded
       */
      const response = await this.checkFileFullness(file);

      /**
       * Respond if file fully uploaded
       */
      if (response) {
        client.respond(file.id, response);
      }
    }
  }

  /**
   * Parse and hand over to onMessage if file data is full
   *
   * @param file - uploading file
   */
  private async checkFileFullness(file: UploadingFile): Promise <void | ApiResponse['payload']> {
    /**
     * Check is file fully uploaded
     */
    if (file.chunks === file.uploadedChunksCount) {
      /**
       * Make an file request object
       */
      const parsedFile = {
        type: file.type,
        payload: file.payload,
        file: file.file,
      } as ApiFileRequest;

      /**
       * Remove file from uploading files
       */
      this.uploadingFiles.splice(this.uploadingFiles.indexOf(file), 1);

      return await this.options.onMessage(parsedFile);
    } else {
      return;
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
