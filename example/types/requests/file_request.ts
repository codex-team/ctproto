import { NewMessage } from '../../../src';
import * as Buffer from "buffer";

/**
 * 2 numbers
 */
export interface SFileMessagePayload {
  fileName: string;
}


/**
 * Describes the request for sum of 2 numbers
 */
export default interface FileRequestMessage extends NewMessage<SFileMessagePayload> {
  type: 'file-request';
  file: Buffer;
}
