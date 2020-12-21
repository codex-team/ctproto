import { CTProtoServer } from '../src/server';
import { CTProtoClient } from '../src/client';
import { NewMessage, ResponseMessage } from '../types';

type Payload = Record<string, string>
interface ApiResponse extends ResponseMessage<Payload> {}
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
  async onMessage(message:ApiRequest): Promise<Payload> {
    console.log('CTProtoServer 💖 onMessage:', message);
    return {
      message: 'good job',
    }
  }
})

/**
 * CTProtoClient example
 */
const client = new CTProtoClient<Payload, AuthorizeMessagePayload, ApiResponse>({
  apiUrl: 'ws://localhost:8080',
  authRequestPayload: {
    token: 'asd',
  },
  onAuth: (data: Payload) => {
    console.log('CTProtoClient 💖 onAuth: ', data);
  },
  onMessage: (data: Payload) => {
    console.log('CTProtoClient 💖 onMessage: ', data);
  }
});

/**
 * Send message
 */
client.send('tmp', {}, (data => {
  console.log('cb log: ', data);
}));
