/* eslint-disable @typescript-eslint/no-magic-numbers */
import { CTProtoServer } from './../../src/server';
import { createWsMockWithMessage, socketSend } from './ws.mock';
import { createMessage, createMessageId } from './utils';

/**
 * These tests are not working properly!
 * All the expects inside the setTimeout always pass.
 *
 *  @todo Use end-to-end testing to test the responding logic
 */

/**
 * Mock of external onAuth method that will do app-related authorization
 */
const onAuthMock = jest.fn();

/**
 * Mock of external onMessage method that will do app-related message handling
 */
const onMessageMock = jest.fn();

describe('CTProtoServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    /**
     * This mocks out setTimeout and other timer functions with mock functions
     */
    jest.useFakeTimers();
  });

  describe('Responding', () => {
    test('should call the "onMessage()" after succeeded auth', () => {
      const secondMessagePayload = {
        someData: '123',
      };

      /**
       * Imitate accepting two messages
       */
      const messageSeries = [
        createMessage({
          type: 'authorize',
          payload: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          },
        }),
        createMessage({
          type: 'some-other-type',
          payload: secondMessagePayload,
        }),
      ];
      const ws = createWsMockWithMessage(undefined, messageSeries);

      // eslint-disable-next-line no-new
      new CTProtoServer({
        onAuth: onAuthMock,
        onMessage: onMessageMock,
        disableLogs: true,
      }, new ws.Server());

      /**
       * Message series will be processed with some delay (see ws.mock.ts@socketOnMock)
       * Wait until all messages will be processed.
       */
      setTimeout(() => {
        expect(onAuthMock).toBeCalledTimes(1); // auth proceeded
        expect(onMessageMock).toBeCalledWith(secondMessagePayload); // onMessage called
      }, 50);
    });

    test('should send a response if the "onMessage" returns something', () => {
      const onMessageResponse = {
        someData: '123',
      };
      const onMessageWithReturnValue = jest.fn(() => {
        return Promise.resolve(onMessageResponse);
      });
      const secondMessageId = createMessageId();

      /**
       * Imitate accepting two messages
       */
      const messageSeries = [
        createMessage({
          type: 'authorize',
          payload: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          },
        }),
        JSON.stringify({
          messageId: secondMessageId,
          type: 'some-message-type',
          payload: {},
        }),
      ];
      const ws = createWsMockWithMessage(undefined, messageSeries);

      // eslint-disable-next-line no-new
      new CTProtoServer({
        onAuth: onAuthMock,
        onMessage: onMessageWithReturnValue,
        disableLogs: true,
      }, new ws.Server());

      /**
       * Message series will be processed with some delay (see ws.mock.ts@socketOnMock)
       * Wait until all messages will be processed.
       */
      setTimeout(() => {
        expect(socketSend).toHaveBeenCalledWith(JSON.stringify({
          messageId: secondMessageId, // reply with id of the second message
          payload: onMessageResponse, // pass data returned by onMessage
        }));
      }, 50);
    });

    test('should not send anything if the "onMessage" throws error', () => {
      const onMessageWithReturnValue = jest.fn(() => {
        throw Error('Some internal error');
      });

      /**
       * Imitate accepting two messages
       */
      const messageSeries = [
        createMessage({
          type: 'authorize',
          payload: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          },
        }),
        createMessage({
          type: 'some-message-type',
          payload: {},
        }),
      ];
      const ws = createWsMockWithMessage(undefined, messageSeries);

      // eslint-disable-next-line no-new
      new CTProtoServer({
        onAuth: onAuthMock,
        onMessage: onMessageWithReturnValue,
        disableLogs: true,
      }, new ws.Server());

      /**
       * Message series will be processed with some delay (see ws.mock.ts@socketOnMock)
       * Wait until all messages will be processed.
       */
      setTimeout(() => {
        expect(socketSend).toHaveBeenCalledTimes(0);
      }, 50);
    });
  });
});
