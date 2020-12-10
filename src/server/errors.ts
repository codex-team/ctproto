/**
 * This class contains all protocol error types
 * --------------------------------------------
 */

/**
 * Critical errors will close connection.
 */
export class CriticalError extends Error {
}

/**
 * Non-critical error won't close connection
 */
export class NonCriticalError extends Error {
}

/**
 * Triggered when the passed message can not be parsed
 * For example, it's not a string of not a valid JSON
 */
export class MessageParseError extends CriticalError {
}

/**
 * Triggered when the passed message doesn't fit required format
 */
export class MessageFormatError extends NonCriticalError {
}
