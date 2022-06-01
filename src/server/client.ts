import ws from 'ws';
import { CloseEventCode } from './closeEvent';
import MessageFactory from './../messageFactory';
import { FileTransferResponseMessage as IFileTransferResponseMessage, NewMessage, ResponseMessage as IResponseMessage } from './../../types';

/**
 * Represents the connected client
 *
 * @template AuthData - structure described authorized client data
 * @template ApiResponse - the type describing all available API response messages
 * @template ApiOutgoingMessage - all available outgoing messages
 */
export default class Client<AuthData, ResponseMessage extends IResponseMessage<unknown>, OutgoingMessage extends NewMessage<unknown>, FileTransferResponseMessage extends IFileTransferResponseMessage<unknown>> {
  /**
   * Store 'ws' socket of a client.
   * Allows us to send him messages or break the connection
   */
  public socket: ws;

  /**
   * Stores app-related auth data returned by 'onAuth' callback
   */
  public authData: AuthData;

  /**
   * Create a new client
   *
   * @param socket - 'ws' socket connected
   * @param authData - app-related data returned by 'onAuth' callback
   */
  constructor(socket: ws, authData: AuthData) {
    this.socket = socket;
    this.authData = authData;
  }

  /**
   * Sends a message to the client
   *
   * @param type - message action type
   * @param payload - data to send
   */
  public send(type: OutgoingMessage['type'], payload: OutgoingMessage['payload']): void {
    this.socket.send(MessageFactory.create(type, payload));
  }

  /**
   * Sends a message as a response to another message
   *
   * @param messageId - id of a message to respond
   * @param payload - data to send
   */
  public respond(messageId: string, payload: ResponseMessage['payload']): void {
    this.socket.send(MessageFactory.respond(messageId, payload));
  }

  /**
   * Sends a message as a response to file transfer
   *
   * @param fileId - id of uploading file
   * @param isUploaded - is file fully uploaded
   * @param chunkNumber - number of uploaded chunk
   * @param payload - data to send
   */
  public respondFileTransferMessage(fileId: string, isUploaded: boolean, chunkNumber: number, payload: FileTransferResponseMessage['payload']): void {
    this.socket.send(MessageFactory.respondFileTransferMessage(fileId, isUploaded, chunkNumber, payload));
  }
  /**
   * Closes connection of selected clients
   *
   * @param code - close event code
   * @param message - error message to send with closing
   */
  public close(code = CloseEventCode.NormalClosure, message = ''): void {
    this.socket.close(code, message);
  }
}
