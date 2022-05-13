# File transfer structure

Every sending file has unique file id, it is divided into several chunks. 

Chunk has a binary structure `Buffer`

## Chunk structure

| 10 bytes  | 4 bytes       | 4 bytes            | n bytes    | remaining bytes |
|-----------|---------------|--------------------|------------|-----------------|
 | file id   | chunk number  | file data size (n) | file data  | message         |

* **file id** - unique upload file ID
* **chunk number** - number in queue of sending chunk 
* **file data size** - how many bytes is the file data
* **chunk offset** - chunk byte shift in sending file
* **file data** - part of file data
* **message** - file transport message payload

Example of the chunk message structure: 
```json
{
  "type": "upload-example-file",
  "payload": {
    "fileName": "myFile.txt"
  },
  "chunks": 5,
  "messageId": "KiO4dInCZz"
}
```

But it might look like this, remaining parameters are not required:
```json
{
  "messageId": "KiO4dInCZz"
}
```

Example of chunk upload response message:
```json
{
  "messageId": "KiO4dInCZz",
  "payload": {
      "chunkNumber": 4,
      "type": "upload-example-file",
      "fileId": "3eo11IpiZC"
  }
}
```

