import { ResponseMessage } from '../../../types';

/**
 * Authorize response payload
 */
export interface AuthorizeResponsePayload {
  /**
   * If authorization is success then this field will be true else will be false
   */
  success: boolean;
  /**
   * Error message
   */
  error?: string;
}

/**
 * Describes the response of the authorize
 */
export default interface AuthorizeResponse extends ResponseMessage<AuthorizeResponsePayload> {}
