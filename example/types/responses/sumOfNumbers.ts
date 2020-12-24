import { ResponseMessage } from '../../../types';

/**
 * Sum of numbers response payload
 */
export interface SumOfNumbersResponsePayload {
  /**
   * Sum of 2 numbers
   */
  sum: number;
}

/**
 * Describes the response of the sum of numbers
 */
export default interface SumOfNumbersResponse extends ResponseMessage<SumOfNumbersResponsePayload> {}
