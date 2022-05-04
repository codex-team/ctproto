import { MessageFormatError, MessageParseError } from './errors';
import { idLength } from './../messageFactory';

/**
 * Provides methods for validating message
 */
export default class MessageValidator {
  /**
   * Check if passed message fits the protocol format.
   * Will throw an error if case of problems.
   * If everything is ok, return void
   *
   * @param message - string got from client by socket
   */
  public static validateMessage(message: unknown): void {
    /**
     * Check for message type
     */
    if (typeof message !== 'string') {
      throw new MessageParseError('Unsupported data');
    }

    /**
     * Check for JSON validness
     */
    let parsedMessage: Record<string, unknown>;

    try {
      parsedMessage = JSON.parse(message);
    } catch (parsingError) {
      throw new MessageParseError((parsingError as Error).message);
    }

    /**
     * Check for required fields
     */
    const requiredMessageFields = ['messageId', 'type', 'payload'];

    requiredMessageFields.forEach((field) => {
      if (parsedMessage[field] === undefined) {
        throw new MessageFormatError(`'${field}' field missed`);
      }
    });

    /**
     * Check fields type
     */
    const fieldTypes = {
      messageId: 'string',
      type: 'string',
      payload: 'object',
    };

    Object.entries(fieldTypes).forEach(([name, type]) => {
      const value = parsedMessage[name];

      if (typeof value !== type) {
        throw new MessageFormatError(`'${name}' should be ${type === 'object' ? 'an' : 'a'} ${type}`);
      }
    });

    /**
     * Check message id for validness
     */
    if (!MessageValidator.isIdValid(parsedMessage.messageId as string)) {
      throw new MessageFormatError('Invalid message id');
    }
  }

  /**
   * Check if passed message fits the protocol format.
   * Will throw an error if case of problems.
   * If everything is ok, return void
   *
   * @param message - buffer got from client by socket
   */
  public static validateBufferMessage(message: unknown): void {
    /**
     * Check for message type
     */
    if (!(message instanceof Buffer)) {
      throw new MessageParseError('Unsupported data');
    }

    /**
     * Parsing meta data from buffer message
     */
    const fileIdLength = 10;
    const sizeOffset = 14;
    const sizeDataLength = 4;

    const fileId = message.slice(0, fileIdLength).toString();
    const size = message.readInt32BE(sizeOffset);

    /**
     * Getting file data
     */
    const dataOffset = sizeOffset + sizeDataLength;

    /**
     * Parsing payload message in buffer message
     */
    const strPayload = message.slice(dataOffset + size).toString();

    /**
     * Check for JSON validness
     */
    try {
      JSON.parse(strPayload);
    } catch (parsingError) {
      throw new MessageParseError((parsingError as Error).message);
    }

    /**
     * Check file id for validness
     */
    if (!MessageValidator.isIdValid(fileId)) {
      throw new MessageFormatError('Invalid file id');
    }
  }

  /**
   * Check message id for validness.
   * It should be a 10 length URL-friendly string
   *
   * @param messageId - id to check
   */
  private static isIdValid(messageId: string): boolean {
    if (messageId.length !== idLength) {
      return false;
    }

    if (!messageId.match(/^[A-Za-z0-9_-]{10}$/)) {
      return false;
    }

    return true;
  }
}
