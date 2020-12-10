/* eslint-disable @typescript-eslint/no-magic-numbers */
import ws from 'ws';

/**
 * Socket .send(message: string) mock
 */
export const socketSend = jest.fn();

/**
 * Mock for socket.on("close", socketOnCloseMock) callback
 */
export const socketOnCloseMock = jest.fn();

/**
 * Socket .close() mock
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const socketClose = jest.fn((_code: number, _message: string) => {
  socketOnCloseMock();
});

/**
 * Creates fake 'ws' library and imitate socket message event with passed payload.
 *
 * @param message - any payload data as it can be got from socket.
 *                  If undefined, there will be no message imitated
 *
 * @param messageSeries - allows to pass message series (list of messages to call it one-by-one)
 */
export function createWsMockWithMessage(message: unknown, messageSeries?: unknown[]): typeof ws {
  /**
   * This is a mock for
   * socket.on(event, callback);
   *
   * it is used for calling the callback passed to the
   * socket.on('message', callback);
   *
   * In tests it will trigger the 'onmessage' handler.
   */
  const socketOnMock = jest.fn((event: string, callback: (param: unknown) => unknown) => {
    if (event !== 'message') {
      return;
    }

    /**
     * Call the 'onmessage' callback with passed message
     */
    if (message !== undefined) {
      callback(message);
    }

    /**
     * If there are several messages, call them one-by-one
     */
    if (messageSeries !== undefined) {
      for (let i = 0, len = messageSeries.length; i < len; i++) {
        /**
         * We use little timeout because it real-app messages will be processed with async/await.
         * Without this timeout they will be processed at same time.
         */
        setTimeout(() => {
          callback(messageSeries[i]);
        }, i * 10);
      }
    }
  });

  /**
   * Fake 'socket' class instance
   */
  const socketMock = {
    on: socketOnMock,
    close: socketClose,
    send: socketSend,
  };

  /**
   * This mock is used to trigger callback passed to the server.on("connection", callback)
   *
   * wsServer.on('connection', (socket: ws, request: http.IncomingMessage) => {
   *   socket.on('message',
   *     (message: ws.Data) => {                <--- we will save this callback and call it with the custom message
   *       this.onmessage(socket, message);
   *      }
   *   );
   * });
   */
  const serverOn = jest.fn((event, callback) => {
    callback(socketMock);
  });

  /**
   * Mock for 'ws' module.
   * Contains only necessary method that is used in tests
   */
  const mockedWs = {
    Server: jest.fn().mockImplementation(() => {
      return {
        on: serverOn,
      };
    }),
  };

  /**
   * We use 'dirty' casting here to not to implement all the properties of 'ws' lib
   */
  return mockedWs as unknown as typeof ws;
}
