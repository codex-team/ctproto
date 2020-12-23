import { CTProtoClient } from '../src/client';
import { ApiRequest, ApiResponse } from './types';
import { AuthorizeMessagePayload } from './types/requests/authorize';
import { AuthorizeResponsePayload } from './types/responses/authorize';

/**
 * CTProtoClient example
 */
export const Client = new CTProtoClient<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse>({
  apiUrl: 'ws://localhost:8080',
  authRequestPayload: {
    token: 'asd',
  },
  onAuth: (data: AuthorizeResponsePayload) => {
    if (!data.success) {
      throw new Error(`${data.error}`);
    }

    console.log('CTProtoClient 💖: Authorization is success', data.success);
  },
  onMessage: (data: ApiResponse['payload']) => {
    console.log('CTProtoClient 💖: onMessage', data);
  }
});

