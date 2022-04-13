import { client } from './client';

/**
 * Sends file and log response info
 *
 * @param file - file to send
 * @param fileName - uploading file name
 */
export function sendFileFromByForm ( file: Buffer, fileName: string ){
  client.sendFile('file-request', file, { fileName: fileName }).then(
    (res) => {
      console.log('Response with info about destination of your uploaded file:', res);
    }
  )
}
