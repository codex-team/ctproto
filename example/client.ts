import { CTProtoClient } from '../src/client';
import { authorizeRequestPayloadMock } from './mocks/authorizeRequestPayload';
import { ApiRequest, ApiResponse, ApiUpdate } from './types';
import { AuthorizeMessagePayload } from './types/requests/authorize';
import { AuthorizeResponsePayload } from './types/responses/authorize';

/**
 * CTProtoClient example
 */
export const client = new CTProtoClient<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiUpdate>({
  apiUrl: 'ws://localhost:8080',
  authRequestPayload: authorizeRequestPayloadMock,
  onAuth: (data: AuthorizeResponsePayload) => {
    console.log('CTProtoClient (example): Authorization succeeded', data);
  },
  onMessage: (data: ApiUpdate) => {
    console.log('CTProtoClient (example): got the update', data);
  },
});
