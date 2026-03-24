/**
 * API error codes — backend returns these, frontend maps to Vietnamese display text.
 * Format: { code, httpStatus, defaultMessage (English) }
 */
export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', httpStatus: 401, defaultMessage: 'Invalid email or password' },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', httpStatus: 401, defaultMessage: 'Token has expired' },
  TOKEN_INVALID: { code: 'TOKEN_INVALID', httpStatus: 401, defaultMessage: 'Invalid token' },
  REFRESH_TOKEN_INVALID: { code: 'REFRESH_TOKEN_INVALID', httpStatus: 401, defaultMessage: 'Invalid or expired refresh token' },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', httpStatus: 401, defaultMessage: 'Authentication required' },

  // Authorization
  FORBIDDEN: { code: 'FORBIDDEN', httpStatus: 403, defaultMessage: 'Insufficient permissions' },
  ACCOUNT_INACTIVE: { code: 'ACCOUNT_INACTIVE', httpStatus: 403, defaultMessage: 'Account is inactive' },

  // Validation
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', httpStatus: 400, defaultMessage: 'Validation failed' },
  BAD_REQUEST: { code: 'BAD_REQUEST', httpStatus: 400, defaultMessage: 'Bad request' },

  // Resource
  NOT_FOUND: { code: 'NOT_FOUND', httpStatus: 404, defaultMessage: 'Resource not found' },
  CONFLICT: { code: 'CONFLICT', httpStatus: 409, defaultMessage: 'Resource already exists' },
  EMAIL_EXISTS: { code: 'EMAIL_EXISTS', httpStatus: 409, defaultMessage: 'Email already in use' },

  // Rate limiting
  RATE_LIMITED: { code: 'RATE_LIMITED', httpStatus: 429, defaultMessage: 'Too many requests' },

  // Server
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', httpStatus: 500, defaultMessage: 'Internal server error' },

  // VoIP
  ESL_UNAVAILABLE: { code: 'ESL_UNAVAILABLE', httpStatus: 503, defaultMessage: 'VoIP service unavailable' },
  AGENT_NOT_READY: { code: 'AGENT_NOT_READY', httpStatus: 400, defaultMessage: 'Agent is not in ready state' },
  INVALID_PHONE: { code: 'INVALID_PHONE', httpStatus: 400, defaultMessage: 'Invalid phone number format' },

  // Webhook
  WEBHOOK_UNAUTHORIZED: { code: 'WEBHOOK_UNAUTHORIZED', httpStatus: 401, defaultMessage: 'Webhook authentication failed' },
  WEBHOOK_IP_REJECTED: { code: 'WEBHOOK_IP_REJECTED', httpStatus: 403, defaultMessage: 'Webhook IP not allowed' },

  // File
  FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', httpStatus: 413, defaultMessage: 'File exceeds size limit' },
  INVALID_FILE_TYPE: { code: 'INVALID_FILE_TYPE', httpStatus: 400, defaultMessage: 'Invalid file type' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
