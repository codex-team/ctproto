import { NewMessage } from '../../../types';

/**
 * 2 numbers
 */
export interface SumOfNumbersMessagePayload {
  a: number;
  b: number;
}

/**
 * Describes the request for sum of 2 numbers
 */
export default interface SumOfNumbersMessage extends NewMessage<SumOfNumbersMessagePayload> {
  type: 'sum-of-numbers';
}
