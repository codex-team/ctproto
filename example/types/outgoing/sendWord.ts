import { NewMessage } from '../../../types';

/**
 * Some word that will be sent
 */
export interface SendWordPayload {
  word: string;
}

/**
 * Describes the outgoing message that will be sent when something is happened to send word
 */
export default interface SendWordMessage extends NewMessage<SendWordPayload> {
  type: 'send-word';
}
