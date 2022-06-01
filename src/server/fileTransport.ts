import {Buffer} from "buffer";

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
  type?: string;

  /**
   * Additional information
   */
  payload?: unknown,

  /**
   * Whole file buffer, it replenishes when new chunk comes
   */
  file: Buffer,

  /**
   * Number of file chunks
   */
  chunks?: number,

  /**
   * Array with info about uploading chunks
   */
  uploadedChunks: Array<boolean>,

  /**
   * Timeout id of chunks uploading
   */
  uploadingWaitingTimeoutId?: NodeJS.Timeout;
}

/**
 * Provides methods for file transport
 */
export default class FileTransport {
  /**
   * Update file data, insert incoming chunk
   *
   * @param file - uploading file
   * @param chunkSlice - chunk offset
   * @param fileChunk - data to insert
   */
  public static updateFileData(file: UploadingFile, chunkSlice: number, fileChunk: Buffer): void {
    let fileData;

    /**
     * Check if incoming chunk offset is bigger then saved file data
     */
    if (file.file.length < chunkSlice + fileChunk.length) {
      /**
       * Creates new buffer with size of new chunk
       */
      fileData = Buffer.alloc(chunkSlice + fileChunk.length);

      /**
       * Pass previous file data to new buffer
       */
      file.file.copy(fileData);

      /**
       * Pass incoming chunk data to new buffer
       */
      fileChunk.copy(fileData, chunkSlice);

      /**
       * Change file data
       */
      file.file = fileData;
    } else {

      /**
       * Pass incoming chunk data saved file data, in case, when chunk offset is less than saved file data
       */
      fileChunk.copy(file.file, chunkSlice);
    }
  }

  /**
   * Check is file fully uploaded
   *
   * @param file - uploading file
   */
  public static isFileFullyUploaded(file: UploadingFile): boolean {
    if (!file.chunks) {
      return false;
    }
    for ( let i = 0 ; i < file.chunks ; i++ ) {
      if (!file.uploadedChunks[i]) {
        return false;
      }
    }

    return true;
  }
}
