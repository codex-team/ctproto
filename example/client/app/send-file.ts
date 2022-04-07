import { client } from './client';

export function my_function ( file: Buffer, fileName: string ){
  client.sendFile('file-request', file, { fileName: fileName }).then(
    (res) => {
      console.log('Response with info about destination of your uploaded file:', res);
    }
  )
}
