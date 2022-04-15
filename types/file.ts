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
  file: Buffer,

  /**
   * Number of file chunks
   */
  chunks?: number

  /**
   * Number of uploaded file chunks
   */
  uploadedChunks: number

  /**
   * Buffer limit on the client side
   */
  bufferLimit: number
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
  payload: unknown,

  /**
   * File data
   */
  file: Buffer,
}
