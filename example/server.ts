import { CTProtoServer } from '../src/server';
import { ApiRequest, ApiResponse, ApiOutgoingMessage } from './types';
import {SumOfNumbersMessagePayload} from './types/requests/sumOfNumbers';
import {SumOfNumbersResponsePayload} from './types/responses/sumOfNumbers';
import {AuthorizeMessagePayload} from './types/requests/authorize';
import {AuthorizeResponsePayload} from './types/responses/authorize';

const sumNumbers = (numbers: SumOfNumbersMessagePayload) => {
  return numbers.a + numbers.b;
}

export const createServer = (): CTProtoServer<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiOutgoingMessage> => {
  /**
   * CTProtoServer example
   */
  return new CTProtoServer<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiOutgoingMessage>({
    port: 8080,
    async onAuth(authRequestPayload: AuthorizeMessagePayload): Promise<AuthorizeResponsePayload> {
      console.log('CTProtoServer 💖 [onAuth]:', authRequestPayload);

      if (authRequestPayload.token == 'asd'){
        return {
          success: true,
        }
      }

      return {
        success: false,
      }
    },
    async onMessage(message: ApiRequest): Promise<ApiResponse['payload'] | void> {
      console.log('CTProtoServer 💖 [onMessage]:', message);

      if (message.type == 'sum-of-numbers') {
        return {
          sum: sumNumbers(message.payload),
        }
      }
    }
  });
}
