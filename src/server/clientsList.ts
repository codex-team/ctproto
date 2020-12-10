import Client from './client';
import { CloseEventCode } from './closeEvent';
import { NewMessage, ResponseMessage as IResponseMessage } from './../../types';

/**
 * Method for finding a client by some external logic.
 * Will be passed to the Array.find() method
 */
type ClientQueryCallback<
    AuthData,
    ResponseMessage extends IResponseMessage<unknown>,
    OutgoingMessage extends NewMessage<unknown>
  > = (
      client: Client<AuthData, ResponseMessage, OutgoingMessage>,
      index: number,
      array: Client<AuthData, ResponseMessage, OutgoingMessage>[]
    ) => boolean;

/**
 * Connected clients manager.
 * Allows to find, send messages and so on
 *
 * Pattern: Fluent Interface
 * https://en.wikipedia.org/wiki/Fluent_interface
 *
 * @template AuthData - structure described authorized client data
 * @template ApiResponse - the type describing all available API response messages
 * @template ApiOutgoingMessage - all available outgoing messages
 */
export default class ClientsList<AuthData, ResponseMessage extends IResponseMessage<unknown>, OutgoingMessage extends NewMessage<unknown>> {
  /**
   * Stores connected clients list
   */
  private clients: Client<AuthData, ResponseMessage, OutgoingMessage>[] = [];

  /**
   * This property will store currently found items.
   * Used for chaining via Fluent Interface:
   *
   * @example  clients.find((client) => client.socket === socket ).remove();
   */
  private cursor: Client<AuthData, ResponseMessage, OutgoingMessage>[] | undefined;

  /**
   * Saves the new client
   *
   * @param client - client to save
   */
  public add(client: Client<AuthData, ResponseMessage, OutgoingMessage>): ClientsList<AuthData, ResponseMessage, OutgoingMessage> {
    this.clients.push(client);

    return this;
  }

  /**
   * Return client by find callback
   *
   * @param queryCallback - search function
   */
  public find(queryCallback: ClientQueryCallback<AuthData, ResponseMessage, OutgoingMessage>): ClientsList<AuthData, ResponseMessage, OutgoingMessage> {
    this.cursor = this.clients.filter(queryCallback);

    return this;
  }

  /**
   * Return true if cursor has a value
   */
  public exists(): boolean {
    return this.cursor !== undefined && Array.isArray(this.cursor) && this.cursor.length > 0;
  }

  /**
   * Returns found items
   */
  public execute(): Client<AuthData, ResponseMessage, OutgoingMessage>[] | undefined {
    return this.cursor;
  }

  /**
   * Returns the first found item
   */
  public current(): Client<AuthData, ResponseMessage, OutgoingMessage> | undefined {
    if (!this.cursor || this.cursor.length === 0) {
      return undefined;
    }

    return this.cursor[0];
  }

  /**
   * Returns array of found items, or empty array
   */
  public toArray(): Client<AuthData, ResponseMessage, OutgoingMessage>[] {
    return this.cursor || [];
  }

  /**
   * Returns array of found items, or empty array
   */
  public remove(): ClientsList<AuthData, ResponseMessage, OutgoingMessage> {
    if (!this.cursor) {
      return this;
    }

    /**
     * Close connections before removing
     */
    this.close();

    this.cursor.forEach(client => {
      const index = this.clients.indexOf(client);

      if (index > -1) {
        this.clients.splice(index, 1);
      }
    });

    return this;
  }

  /**
   * Sends a message to the found clients
   *
   * @param type - message action type
   * @param payload - data to send
   */
  public send(type: OutgoingMessage['type'], payload: OutgoingMessage['payload']): ClientsList<AuthData, ResponseMessage, OutgoingMessage> {
    if (!this.cursor) {
      return this;
    }

    this.cursor.forEach(client => {
      client.send(type, payload);
    });

    return this;
  }

  /**
   * Closes connection of selected clients
   *
   * @param code - close event code
   * @param message - error message to send with closing
   */
  public close(code = CloseEventCode.NormalClosure, message = ''): ClientsList<AuthData, ResponseMessage, OutgoingMessage> {
    if (!this.cursor) {
      return this;
    }

    this.cursor.forEach(client => {
      client.close(code, message);
    });

    return this;
  }
}
