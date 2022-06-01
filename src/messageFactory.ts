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
   */
  public static createChunkMessage<MessagePayload>(type?: string, payload?: MessagePayload, chunks?: number): string {
    return JSON.stringify({
      type,
      payload,
      chunks,
      messageId: MessageFactory.createMessageId(),
    });
  }

  /**
   * Creates the buffer chunk
   *
   * @param fileId - file id
   * @param chunkNumber - number of chunk
   * @param size - file data size
   * @param bufData - buffer of file
   * @param message - message to send with chunk
   */
  public static packChunk(fileId: string, chunkNumber: number, size: number, bufData: Uint8Array, message: string): Uint8Array {
    const enc = new TextEncoder();

    const bufFileId = enc.encode(fileId);

    const bufMessage = enc.encode(message);

    const bufInfo = new Uint32Array([chunkNumber, size]);

    const bufChunkInfo = new Uint8Array(bufInfo.buffer);

    const chunk = new Uint8Array(bufFileId.length + bufChunkInfo.length + bufData.length + bufMessage.length);

    chunk.set(bufFileId);

    chunk.set(bufChunkInfo, bufFileId.length);

    chunk.set(bufData, bufFileId.length + bufChunkInfo.length);

    chunk.set(bufMessage, bufFileId.length + bufChunkInfo.length + bufData.length);

    return chunk;
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
