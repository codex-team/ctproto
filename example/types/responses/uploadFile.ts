import { ResponseMessage } from '../../../types';

/**
 * File response payload
 */
export interface UploadFileResponsePayload {
    /**
     * Path of file
     */
    path: string;
}

/**
 * Describes the response file uploading
 */
export default interface UploadFileResponse extends ResponseMessage<UploadFileResponsePayload> {}
