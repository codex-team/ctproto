import Authorize from './requests/authorize';
import SumOfNumbers from './requests/sumOfNumbers';
import AuthorizeResponse from './responses/authorize';
import SumOfNumbersResponse from './responses/sumOfNumbers';
import SendWord from './outgoing/sendWord';
import FileRequest from './requests/file_request';
import FileRequestResponse from "./responses/file_request";

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

export type ApiFileRequest =
  | FileRequest
/**
 * The type described all available API response messages
 */
export type ApiResponse =
  | AuthorizeResponse
  | SumOfNumbersResponse
  | FileRequestResponse
