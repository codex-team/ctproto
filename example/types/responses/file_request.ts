import { ResponseMessage } from '../../../types';

/**
 * File response payload
 */
export interface FileRequestResponsePayload {
    /**
     * Path of file
     */
    path: string;
}

/**
 * Describes the response file uploading
 */
export default interface FileRequestResponse extends ResponseMessage<FileRequestResponsePayload> {}
