import { Buffer } from 'buffer';

/**
 * Data for files to upload
 */
export interface UploadingFile {
  /**
   * File id
   */
  id: string;

  /**
   * File request type
   */
  type?: string;

  /**
   * Additional information
   */
  payload?: unknown,

  /**
   * Array of file chunks
   */
  file: Array<Buffer>,

  /**
   * Number of file chunks
   */
  chunks?: number
}

/**
 * Interface for file data which is uploaded
 */
export interface FileRequest {

  /**
   * Request type
   */
  type: string,

  /**
   * Some client additional info
   */
  payload: any,

  /**
   * File data
   */
  file: Buffer,
}
