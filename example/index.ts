import { CTProtoServer } from '../src/server';
import { CTProtoClient } from '../src/client';
import { NewMessage, ResponseMessage } from '../types';

type Payload = Record<string, string>
interface ApiResponse extends NewMessage<Payload> {}
interface ApiRequest extends NewMessage<Payload> {}
interface ApiOutgoingMessage extends NewMessage<Payload>{}
type AuthorizeMessagePayload  = {
  token: string;
}
type AuthData = {
  message: string;
}

/**
 * CTProtoServer example
 */
const server = new CTProtoServer<AuthorizeMessagePayload, AuthData, ApiRequest, ApiResponse, ApiOutgoingMessage>({
  port: 8080,
  async onAuth(authRequestPayload: AuthorizeMessagePayload): Promise<AuthData> {
    console.log('CTProtoServer 💖 onAuth:', authRequestPayload);
    if (authRequestPayload.token == 'asd'){
      return {
        message: 'true token',
      }
    }

    return {
      message: 'bad token',
    }
  },
  async onMessage(message:ApiRequest): Promise<void> {
    console.log('Request:\n', message);
  }
})

/**
 * CTProtoClient example
 */
const client = new CTProtoClient<Payload, NewMessage<Payload>, ApiResponse>({
  apiUrl: 'ws://localhost:8080',
  authRequestPayload: {
    token: 'asd',
  },
  onAuth: (data: ResponseMessage<Payload>) => {
    console.log('CTProtoClient 💖 onAuth: ', data);
  },
  onMessage: (data: ResponseMessage<Payload>) => {
    console.log('CTProtoClient 💖 onMessage: ', data);
  }
});
