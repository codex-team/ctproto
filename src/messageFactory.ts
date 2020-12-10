import { NewMessage, ResponseMessage } from './../types';
import { nanoid } from 'nanoid';

/**
 * Length of message id string
 */
export const idLength = 10;

/**
 * Class for creating of messages
 */
export default class MessageFactory {
  /**
   * Creates the NewMessage
   *
   * @template MessagePayload - the type describing structure of the message payload
   *
   * @param type - message action type
   * @param payload - data to send
   */
  public static create<MessagePayload>(type: string, payload: MessagePayload): string {
    return JSON.stringify({
      type,
      payload,
      messageId: MessageFactory.createMessageId(),
    } as NewMessage<MessagePayload>);
  }

  /**
   * Creates the RespondMessage
   *
   * @template MessagePayload - the type describing structure of the message payload
   *
   * @param messageId - id of a message to respond
   * @param payload - data to send
   */
  public static respond<MessagePayload>(messageId: string, payload: MessagePayload): string {
    return JSON.stringify({
      messageId,
      payload,
    } as ResponseMessage<MessagePayload>);
  }

  /**
   * Creates the NewMessage for error answer
   *
   * @template MessagePayload - the type describing structure of the message payload
   *
   * @param error - text to send as error
   */
  public static createError(error: string): string {
    return JSON.stringify({
      type: 'error',
      payload: {
        error,
      },
      messageId: MessageFactory.createMessageId(),
    } as NewMessage<{error: string}>);
  }

  /**
   * Creates unique message id
   */
  private static createMessageId(): string {
    return nanoid(idLength);
  }
}
