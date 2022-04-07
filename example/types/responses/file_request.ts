import { ResponseMessage } from '../../../types';

/**
 * Sum of numbers response payload
 */
export interface FileRequestResponsePayload {
    /**
     * Sum of 2 numbers
     */
    path: string;
}

/**
 * Describes the response of the sum of numbers
 */
export default interface FileRequestResponse extends ResponseMessage<FileRequestResponsePayload> {}
