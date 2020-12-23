import { Client } from './client';
import { createServer } from './server';

const Server = createServer();

Client.send('sum-of-numbers', {
  a: 10,
  b: 11,
}).then((responsePayload) => {
  console.log('Response: ',responsePayload);
});
