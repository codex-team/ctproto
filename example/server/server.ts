import { CTProtoServer } from '../../src';
import {ApiFileRequest, ApiRequest, ApiResponse, ApiUpdate} from '../types';
import { SumOfNumbersMessagePayload } from '../types/requests/sumOfNumbers';
import { authTokenMock } from '../mocks/authorizeRequestPayload';
import { AuthorizeMessagePayload } from '../types/requests/authorize';
import { AuthorizeResponsePayload } from '../types/responses/authorize';

/**
 * The example of some API method
 *
 * @param numbers - request payload
 */
const sumNumbers = (numbers: SumOfNumbersMessagePayload): number => {
  return numbers.a + numbers.b;
};

/**
 * Method for creating a server instance
 */
export function createServer(): CTProtoServer<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiUpdate> {
  /**
   * CTProtoServer example
   */
  const server = new CTProtoServer<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiUpdate>({
    port: 8080,
    async onAuth(authRequestPayload: AuthorizeMessagePayload): Promise<AuthorizeResponsePayload> {
      if (authRequestPayload.token == authTokenMock) {
        return {
          userId: '123',
        };
      }

      throw new Error('Example of unsuccessful auth');
    },
    async onMessage(message: ApiRequest | ApiFileRequest): Promise<ApiResponse['payload'] | void> {
      if (message.type == 'sum-of-numbers') {
        return {
          sum: sumNumbers(message.payload),
        };
      }
    },
  });

  return server;
}
