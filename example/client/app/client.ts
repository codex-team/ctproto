import { CTProtoClient } from '../../../build/src';
// import { CTProtoClient } from 'ctproto';
import { authorizeRequestPayloadMock } from '../../mocks/authorizeRequestPayload';
import { ApiRequest, ApiResponse, ApiUpdate, ApiUploadRequest, ApiUploadResponse } from '../../types';
import { AuthorizeMessagePayload } from '../../types/requests/authorize';
import { AuthorizeResponsePayload } from '../../types/responses/authorize';

/**
 * CTProtoClient example
 */
export const client = new CTProtoClient<AuthorizeMessagePayload, AuthorizeResponsePayload, ApiRequest, ApiResponse, ApiUpdate, ApiUploadRequest, ApiUploadResponse>({
  apiUrl: 'ws://localhost:8080',
  authRequestPayload: authorizeRequestPayloadMock,
  onAuth: (data: AuthorizeResponsePayload) => {
    console.log('CTProtoClient (example): Authorization succeeded', data);
  },
  onMessage: (data: ApiUpdate) => {
    console.log('CTProtoClient (example): got the update', data);
  },
});


client.send('sum-of-numbers', {
  a: 10,
  b: 11,
})
  .then((responsePayload) => {
    console.log('Response for "sum-of-numbers": ', responsePayload);
  });
