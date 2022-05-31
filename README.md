# CodeX Transport Protocol

CodeX Transport Protocol (CTProto) - is the presentation-layer of the [OSI](https://en.wikipedia.org/wiki/OSI_model) model for communication between services.

This is a JavaScript implementation example.

## Connection

CTProto uses WebSockets as transport-layer.

After connection to the endpoint specified by application, you need to send the __authorization__ message in 3 seconds. Otherwise, the connection will be closed.

## Communication

### Message format

All messages MUST fit next criteria:

- be a valid JSON-strings
- has the next structure:

| field | type | purpose |
| -- | -- | -- |
| `messageId` | _string_ | Unique message identifier. Create using the [nanoid(10)](https://github.com/ai/nanoid) method |
| `type` | _string_ | Message action type. Related to business logic |
| `payload` | _object_ | Any message data |

Example of a correct message:

```
"{\"messageId\":\"qUw0SWTeJX\",\"type\":\"update-workspace\",\"payload\":{\"name\":\"Example\"}}"
```

You can look at file transfer messages format:

[/docs/file-transfer.md](./docs/file-transfer.md)

## Authorization

The first message after establishing the connection should be the `authorize`. 
If the server won't accept this message after 3 seconds after connection, it will close the connection.

Example of auth request:

```json
{
  "type": "authorize",
  "messageId": "deo2BInCZC",
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
  }
}
```

The `payload` can contain any data that is used for authorization in your application. If auth will be successful, you will get a message with authorization data as a response. For example:

Example of auth response message:

```json
{
  "messageId": "deo2BInCZC",
  "payload": {
    "userId": "12345",
    "workspaceIds": ["111", "222", "333"]
  }
}
```

## Errors 

All errors will be sent to the client with structure like that:

```json
{
  "type": "error",
  "payload": {
    "error":  "Example of the error message"
  },
  "messageId": "3eo11IpiZC"
}
```

## Server

To use CTProto JavaScript server implementation, follow the next guide.

Install a package

```bash
yarn add ctproto
```

Then, configure the server

```ts
import { CTProtoServer } from 'ctproto';

const transport = new CTProtoServer({
  port: 4000,
  path: '/client',
  async onAuth(authRequestPayload){
    const user = aurhorizeUser(authRequestPayload)

    if (!user) {
      throw new Error('Wrong auth payload');
    }

    return {
      user
    };
  },

  async onMessage(message) {
    // massage handling
  },
  async onUploadMessage(fileMessage) {
    // file message handling
  }
});
```

Where 

| option | type                                                             | description                                |
| ------ |------------------------------------------------------------------|--------------------------------------------|
| `onAuth` | _(authRequestPayload: AuthRequestPayload) => Promise<_AuthData>_ | Method for authorization. See details below |
| `onMessage` | _(message: NewMessage) => Promise<_void &#124; object_>_            | Message handler. See details below              |
| `onUploadMessage` | _(fileMessage: NewMessage) => Promise<void &#124; object>_          | Upload message handler. See details below  |

and you can set any [ws.Server](https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback) options.

### onAuth()

This callback will contain your application authorization logic. It will accept the payload of the `authorize` request. 

You can implement your own authorization logic in there, such as DB queries etc.

This method should return authorized client data, such as user id and so on. This data will be returned to client with the next response message.
Also, this data will be saved as `authData` for this connected client under the hood of the protocol. 
You can query it later, for example for sending messages to some connected clients:

```ts
const workspaceId = '123';

transport
    .clients
    .find((client: Client) => client.authData.workspaceIds.includes(workspaceId))
    .send('workspace-updated', { workspace });
```

### onMessage()

This callback will be fired when the new message accepted from the client. It will get a whole message object as a param.

You can handle a message and optionally you can return a value (`object`) to respond on this message. 

### onUploadMessage()

This callback will be fired when the file is fully uploaded from the client. It will get a whole file request object as a param.

You can handle a file transfer message and optionally you can return a value (`object`) to respond on this uploading.

## Client

To use CTProto JavaScript client implementation, follow the next guide.

Install a package

```bash
yarn add ctproto
```

Then, configure the client

```ts
import { CTProtoClient } from 'ctproto';

const client = new CTProtoClient({
    apiUrl: 'ws://localhost:8080',
    authRequestPayload: {
        token: 'asd',
    },
    onAuth: (data) => {
        if (!data.success) {
            throw new Error(`${data.error}`);
        }

        console.log('Authorization is success', data.success);
    },
    onMessage: (data) => {
        console.log('Incomming message: ', data);
    }
});
```

Where

| option | type | description |
| -- | -- | -- |
| `apiUrl` | _string_ | Requests will be made to this API. |
| `authRequestPayload` | _AuthRequestPayload_ | Authorization request payload. |
| `onAuth` | _(payload: AuthResponsePayload) => void_ | Method for handling authorization response. See details below |
| `onMessage` | _(message: ApiUpdate) => void_ | Method for handling message initialized by the server. See details below |

### onAuth()

This callback will contain your application authorization response handler. It will accept the payload of the authorize response.

You can implement your own authorization response handler in there.

### onMessage()

This callback will be fired when an `ApiUpdate` (new message initialized by the server) accepted from the server. It will get a message object as a param.

### Sending requests

You can send a request and get a response:

```ts
client
    .send(type, payload)
    .then((responsePayload) => {
        // do something with the response payload
    });
```

Where

| parameter | type | description |
| -- | -- | -- |
| `type` | _ApiRequest['type']_ | Type of available request. |
| `payload` | _ApiRequest['payload']_ | Request payload. |
| `responsePayload` | _ApiResponse['payload']_ | Response payload. |

Example

```ts
client
    .send('sum-of-number', {
        a: 10,
        b: 11,
    })
    .then((responsePayload) => {
        console.log('Response: ', responsePayload);
    });
```

You can send a file and get uploading response:

```ts
client
    .sendFile(type, file, payload)
    .then((responsePayload) => {
        // do something with the response payload
    });
```

Where


| parameter         | type                        | description           |
|-------------------|-----------------------------|-----------------------|
| `type`            | ApiUploadRequest['type']    | Type of file request. |
| `file`            | ArrayBuffer                 | File data.            |
| `payload`         | ApiUploadRequest['payload'] | Request payload.      |
 | `responsePayload` | ApiResponse['payload']      | Response payload.     |

Example

```ts
client
    .sendFile('upload-example-file', file, {
        fileName: 'MyFile.txt',
    })
    .then((responsePayload) => {
        console.log('Response: ', responsePayload);
    });
```

## Using in TypeScript

If you're using TS, you will need to create interfaces describing some CTProto objects: `AuthorizeMessagePayload`, `AuthorizeResponsePayload`, `ApiRequest`, `ApiResponse`, `ApiUpdate`.

| Type                       | Description                                                                               | Example |
|----------------------------|-------------------------------------------------------------------------------------------| --------|
| `AuthorizeMessagePayload`  | Payload of your `authorize` message. See [Authorization](#authorization).                 | Example: [/example/types/requests/authorize.ts](./example/types/requests/authorize.ts) |
| `AuthorizeResponsePayload` | Payload of the response on your `authorize` message. See [Authorization](#authorization). | Example: [/example/types/responses/authorize.ts](./example/types/responses/authorize.ts) |
| `ApiRequest`               | All available messages that can be sent from the Client to the Server                     | Example: [/example/types/index.ts](./example/types/index.ts) | 
| `ApiUploadRequest`         | All available file transfer messages that can be sent from the Client to the Server       | Example: [/example/types/index.ts](./example/types/index.ts) | 
| `ApiResponse`              | All available messages that can be sent by the Server in response to Client requests      | Example: [/example/types/index.ts](./example/types/index.ts) |
| `ApiUpdate`                | All available messages that can be sent by the Server to the Client                       | Example: [/example/types/index.ts](./example/types/index.ts) |

All examples see at the [/example](./example) directory. 

# About CodeX

<img align="right" width="120" height="120" src="https://codex.so/public/app/img/codex-logo.svg" hspace="50">

CodeX is a team of digital specialists around the world interested in building high-quality open source products on a global market. We are [open](https://codex.so/join) for young people who want to constantly improve their skills and grow professionally with experiments in cutting-edge technologies.

| 🌐 | Join  👋  | Twitter | Instagram |
| -- | -- | -- | -- |
| [codex.so](https://codex.so) | [codex.so/join](https://codex.so/join) |[@codex_team](http://twitter.com/codex_team) | [@codex_team](http://instagram.com/codex_team/) |
