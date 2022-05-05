# File transfer structure

## Client side

To send file you can use method `sendFile(type, file, payload)`

| Parameter | Role                             |
|-----------|----------------------------------|
 | type      | Request type to handle on server |
 | file      | File to send                     |
 | payload   | Any data with file               |

`sendFile` does the following list of things:

1. Generate unique file id
2. Calculate number of chunk to send
3. Create object `UploadingFiles` to save file data
4. Create payload for the first chunk
5. Call method `sendChunk` with the first chunk

Method `sendChunk` has the following parameters

| Parameter   | Role                            |
|-------------|---------------------------------|
| file        | File, which chunk needs to send |
| chunkNumber | Number of chunk to send         |
| message     | Message                         |

## Chunk structure

| 10 bytes  | 4 bytes       | 4 bytes            | 4 bytes      | n bytes   | remaining bytes |
|-----------|---------------|--------------------|--------------|-----------|-----------------|
 | file id   | chunk number  | file data size (n) | chunk offset | file data | message         |

* **file id** - unique upload file ID
* **chunk number** - number in queue of sending chunk 
* **file data size** - how many bytes is the file data
* **chunk offset** - chunk byte shift in sending file
* **file data** - part of file data
* **message** - file transport message payload

Example of the thirst chunk message structure: 
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

Example of remaining chunks messages:
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

