import { ResponseMessage } from '../../../types';

/**
 * File response payload
 */
export interface UploadExampleFileResponsePayload {
    /**
     * Path of file
     */
    path: string;
}

/**
 * Describes the response file uploading
 */
export default interface UploadExampleFileResponse extends ResponseMessage<UploadExampleFileResponsePayload> {}
