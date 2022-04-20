import { Buffer } from 'buffer';

/**
 * Data for uploading files
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
   * Whole file buffer
   */
  file: Buffer,

  /**
   * Number of file chunks
   */
  chunks?: number

  /**
   * Number of uploaded file chunks
   */
  uploadedChunksCount: number

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
