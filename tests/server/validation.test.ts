/* eslint-disable no-new */ // to allow calling new CTProtoServer() without assigning

import { CTProtoServer } from './../../src/server';
import { createWsMockWithMessage, socketClose, socketSend } from './ws.mock';

describe('CTProtoServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * In all tests at this section, options are not used, so we mock it with empty values
   */
  const transportConfig = {
    onAuth: jest.fn(),
    onMessage: jest.fn(),
    disableLogs: true,
  };

  /**
   * This section contains message format validation tests
   */
  describe('Message validation', () => {
    test('should break the connection if message is not a string', () => {
      /**
       * Imitate the message with unsupported data. For example, ArrayBuffer
       */
      const socketMessage = new ArrayBuffer(0);
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(1);
    });

    test('should break the connection if message is not a valid JSON', () => {
      /**
       * Imitate the message that's not a JSON string
       */
      const socketMessage = 'some string but not a JSON';
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(1);
    });

    test('should send an error if message has no «messageId» property', () => {
      /**
       * Imitate the message without 'messageId'
       */
      const socketMessage = JSON.stringify({ foo: 'bar' });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(0);
      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching(`Message Format Error: 'messageId' field missed`));
    });

    test('should send an error if message has no «type» property', () => {
      /**
       * Imitate the message without the 'type'
       */
      const socketMessage = JSON.stringify({ messageId: '123' });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(0);
      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching(`Message Format Error: 'type' field missed`));
    });

    test('should send an error if message has no «payload» property', () => {
      /**
       * Imitate the message without the 'payload'
       */
      const socketMessage = JSON.stringify({
        messageId: 'eLtvjKH8a2',
        type: 'some-type',
      });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(0);
      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching(`Message Format Error: 'payload' field missed`));
    });

    test('should send an error if message «messageId» is not a string', () => {
      /**
       * Imitate the message with '«messageId»' that is not a string
       */
      const socketMessage = JSON.stringify({
        messageId: 123, // <-- not a string
        payload: {},
        type: 'some-type',
      });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(0);
      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching(`Message Format Error: 'messageId' should be a string`));
    });

    test('should send an error if message «type» is not a string', () => {
      /**
       * Imitate the message with 'type' that is not a string
       */
      const socketMessage = JSON.stringify({
        messageId: 'eLtvjKH8a2',
        payload: {},
        type: 123,
      });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(0);
      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching(`Message Format Error: 'type' should be a string`));
    });

    test('should send an error if message «payload» is not an object', () => {
      /**
       * Imitate the message with the 'payload' that is not an object
       */
      const socketMessage = JSON.stringify({
        messageId: 'eLtvjKH8a2',
        type: 'some-type',
        payload: 'not an object', // <-- not an object
      });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketClose).toBeCalledTimes(0);
      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching(`Message Format Error: 'payload' should be an object`));
    });

    test('should send an error if «messageId» is invalid', () => {
      /**
       * Imitate the message with '«messageId»' that is not a string
       */
      const socketMessage = JSON.stringify({
        messageId: 'authorize', // <-- invalid message id
        payload: {},
        type: 'some-type',
      });
      const ws = createWsMockWithMessage(socketMessage);

      new CTProtoServer(transportConfig, new ws.Server());

      expect(socketSend).toHaveBeenCalledWith(expect.stringMatching('Message Format Error: Invalid message id'));
      expect(socketClose).toBeCalledTimes(0);
    });
  });
});
