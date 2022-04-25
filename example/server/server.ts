import { CTProtoServer } from '../../build/src';
import { ApiUploadRequest, ApiRequest, ApiResponse, ApiUpdate } from '../types';
import { SumOfNumbersMessagePayload } from '../types/requests/sumOfNumbers';
import { authTokenMock } from '../mocks/authorizeRequestPayload';
import { AuthorizeMessagePayload } from '../types/requests/authorize';
import { AuthorizeResponsePayload } from '../types/responses/authorize';
import * as fs from 'fs';

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
export function createServer(): CTProtoServer<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiUpdate, ApiUploadRequest> {
  /**
   * CTProtoServer example
   */
  const server = new CTProtoServer<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiUpdate, ApiUploadRequest>({
    port: 8080,
    async onAuth(authRequestPayload: AuthorizeMessagePayload): Promise<AuthorizeResponsePayload> {
      if (authRequestPayload.token == authTokenMock) {
        return {
          userId: '123',
        };
      }

      throw new Error('Example of unsuccessful auth');
    },
    async onMessage(message: ApiRequest): Promise<ApiResponse['payload'] | void> {
      if (message.type == 'sum-of-numbers') {
        return {
          sum: sumNumbers(message.payload),
        };
      }
    },
    async onUploadMessage(uploadMessage: ApiUploadRequest): Promise<ApiResponse['payload'] | void> {
      if (uploadMessage.type == 'upload-file') {
        fs.writeFileSync('./files/' + uploadMessage.payload.fileName, uploadMessage.file);
        return {
          path: fs.realpathSync('./files/') + '/' + uploadMessage.payload.fileName,
        };
      }
  },
    }
  );

  return server;
}
