import Authorize from './requests/authorize';
import SumOfNumbers from './requests/sumOfNumbers';
import AuthorizeResponse from './responses/authorize';
import SumOfNumbersResponse from './responses/sumOfNumbers';
import SendWord from './outgoing/sendWord';
import UploadFile from './requests/uploadFile';
import UploadFileResponse from './responses/uploadFile';

/**
 * The type described all available outgoing messages that can be sent by API
 */
export type ApiUpdate =
  | SendWord;

/**
 * The type described all available API request messages
 */
export type ApiRequest =
  | Authorize
  | SumOfNumbers

export type ApiUploadRequest =
  | UploadFile
/**
 * The type described all available API response messages
 */
export type ApiResponse =
  | AuthorizeResponse
  | SumOfNumbersResponse
  | UploadFileResponse
