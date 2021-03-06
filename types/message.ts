/**
 * Any client-server message should fit this structure
 *
 * @template MessagePayload - what kind of data passed with the message
 */
export interface Message<MessagePayload> {
  /**
   * Unique identifier of a message.
   * Uses nanoid(10).
   *
   * In case of ResponseMessage, there will be an id of a message to respond
   * In case of NewMessage, there will be an unique id
   */
  messageId: string;

  /**
   * Any payload like workspaces and etc.
   */
  payload: MessagePayload;
}

/**
 * Message sent in response to another message
 * Contains 'messageId' of the message to reply and the 'payload'
 * Does not contain 'type'
 */
export interface ResponseMessage<MessagePayload> extends Message<MessagePayload> {
}

/**
 * Message generated by Client or an API
 * Contains the 'type' field
 */
export interface NewMessage<MessagePayload> extends Message<MessagePayload> {
  /**
   * Message type definition,
   * for example 'authorize' or 'update-workspace'
   */
  type: string;
}
