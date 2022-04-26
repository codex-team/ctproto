import { Buffer } from 'buffer';

/**
 * Data for uploading files, it uses to identify what file chunk is uploading and store info about file
 */
export interface UploadingFile {
  /**
   * File id
   */
  id: string;

  /**
   * File request type
   */
  type: string;

  /**
   * Additional information
   */
  payload: unknown,

  /**
   * Whole file buffer, it replenishes when new chunk comes
   */
  file: Buffer,

  /**
   * Number of file chunks
   */
  chunks: number

  /**
   * Number of uploaded file chunks
   */
  uploadedChunksCount: number

  /**
   * Buffer limit on the client side, it helps to make slice in buffer to store chunk to it
   */
  bufferLimit: number
}

/**
 * Interface for file data which is uploaded
 */
export interface FileRequest<MessagePayload> {

  /**
   * Request type
   */
  type: string,

  /**
   * Some client additional info
   */
  payload: MessagePayload,

  /**
   * File data
   */
  file: Buffer,
}
