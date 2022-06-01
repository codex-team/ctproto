import { NewFileTransferMessage } from '../../../types/message';

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
export default interface FileRequestMessage extends NewFileTransferMessage<FileMessagePayload> {

  /**
   * File request type
   */
  type: 'upload-example-file';
}
