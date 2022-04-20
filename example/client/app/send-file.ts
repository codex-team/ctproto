import { client } from './client';

/**
 * Sends file and log response info
 *
 * @param file - file to send
 * @param fileName - uploading file name
 */
export function uploadFile ( file: Buffer, fileName: string ){
  client.sendFile('upload-file', file, { fileName: fileName }).then(
    (res) => {
      console.log('Response with info about destination of your uploaded file:', res);
    }
  )
}
