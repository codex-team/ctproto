import { client } from './client';
import { createServer } from './server';

createServer();

client
  .send('sum-of-numbers', {
    a: 10,
    b: 11,
  })
  .then((responsePayload) => {
    console.log('Response for "sum-of-numbers": ', responsePayload);
  });
