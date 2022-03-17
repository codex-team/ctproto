import { Buffer } from 'buffer';

/**
 * Data for files to upload
 */
export interface UploadedFile {
  /**
   * File id
   */
  id: string;

  /**
   * Additional information
   */
  payload?: unknown,

  /**
   * Array of file chunks
   */
  file: Array<Buffer>,

  /**
   * Number of chunks, which consist payload information
   */
  payloadChunks: number,

  /**
   * Number of file chunks
   */
  chunks: number
}
