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
     * Push file data
     */
    if (file.file.length < chunkSlice + fileChunk.length) {
      fileData = Buffer.alloc(chunkSlice + fileChunk.length);
      file.file.copy(fileData);
      fileChunk.copy(fileData, chunkSlice);
    } else {
      fileData = file.file;
      fileChunk.copy(fileData, chunkSlice);
    }

    file.file = fileData;
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
