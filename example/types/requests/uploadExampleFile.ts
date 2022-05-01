import { NewMessage } from '../../../src';
import * as Buffer from 'buffer';

/**
 * File request payload
 */
export interface FileMessagePayload {

  /**
   * File name
   */
  fileName: string;
}


/**
 * File message
 */
export default interface FileRequestMessage extends NewMessage<FileMessagePayload> {

  /**
   * File request type
   */
  type: 'upload-example-file';

  /**
   * File data
   */
  file: Buffer;
}
