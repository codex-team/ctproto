# CodeX Transport Protocol

CodeX Transport Protocol (CTProto) - is the presentation-layer of the [OSI](https://en.wikipedia.org/wiki/OSI_model) model for communication between services.

This is a JavaScript implementation example.

## Connection

CTProto uses WebSockets as transport-layer.

After connection to the endpoint specified by application, you need to send the __authorization__ message in 3 seconds. Otherwise, the connection will be closed.

## Communication

### Message format

All messages MUST fit next criteries:

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

To use CTProto JavaScript server implementation, follow next guide.

```ts
import { CTProtoServer } from './ctproto/server';

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
});
```

Where 

| option | type | description |
| -- | -- | -- |
| `port` | _number_ | The port where to bind the server. |
| `path` | _string_ | Accept only connections matching this path. |
| `onAuth` | _(authRequestPayload: AuthRequestPayload) => Promise<AuthData>_ | Method for authorization. See details below |
| `onMessage` | _(message: NewMessage) => Promise<void | object>_ | Message handler. See details below |

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


## About team

CodeX is a team of passionate engineers and designers, unifying students, graduates, and other young specialists around the world interested in making high-quality open-source projects and getting a priceless experience of making full-valued products on a global market.

Follow us on Twitter: [twitter.com/codex_team](https://twitter.com/codex_team)

Feel free to contact: <a href="mailto:team@codex.so?subject=CTProto">team@codex.so</a>

[codex.so](https://codex.so)
