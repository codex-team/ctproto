import {Buffer} from "buffer";

/**
 * Data for files to upload
 */
export interface UploadedFile {
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
