import { NewMessage, ResponseMessage } from '../types';
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
   * Creates the message for chunk
   *
   * @template MessagePayload - the type describing structure of the message payload
   *
   * @param type - request type
   * @param payload - message for chunk
   * @param chunks - number of chunks
   * @param fileSize - size of file
   */
  public static createMessageForChunk<MessagePayload>(type?: string, payload?: MessagePayload, chunks?: number, fileSize?: number): string {
    return JSON.stringify({
      type,
      payload,
      chunks,
      fileSize,
      messageId: MessageFactory.createMessageId(),
    });
  }

  /**
   * Creates the buffer chunk
   *
   * @param fileId - file id
   * @param bufData - buffer of file and meta data
   * @param message - message to send with chunk
   */
  public static packChunk(fileId: string, bufData: Buffer, message: string): Buffer {
    const bufMessage = Buffer.from(message);

    const bufFileId = Buffer.from(fileId);

    return Buffer.concat( [bufFileId, bufData, bufMessage] );
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
   * Creates unique file id
   */
  public static createFileId(): string {
    return nanoid(idLength);
  }

  /**
   * Creates unique message id
   */
  private static createMessageId(): string {
    return nanoid(idLength);
  }
}
