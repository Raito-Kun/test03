/** Map API error codes (English) to Vietnamese display text */

const errorMap: Record<string, string> = {
  // Auth
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn',
  TOKEN_INVALID: 'Token không hợp lệ',
  REFRESH_TOKEN_INVALID: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  UNAUTHORIZED: 'Vui lòng đăng nhập để tiếp tục',

  // Authorization
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  ACCOUNT_INACTIVE: 'Tài khoản đã bị vô hiệu hóa',

  // Validation
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ',
  BAD_REQUEST: 'Yêu cầu không hợp lệ',

  // Resource
  NOT_FOUND: 'Không tìm thấy dữ liệu',
  CONFLICT: 'Dữ liệu đã tồn tại',
  EMAIL_EXISTS: 'Email đã được sử dụng',

  // Rate limiting
  RATE_LIMITED: 'Quá nhiều yêu cầu, vui lòng thử lại sau',

  // Server
  INTERNAL_ERROR: 'Lỗi hệ thống, vui lòng thử lại sau',

  // VoIP
  ESL_UNAVAILABLE: 'Dịch vụ VoIP không khả dụng',
  AGENT_NOT_READY: 'Nhân viên chưa sẵn sàng nhận cuộc gọi',
  INVALID_PHONE: 'Số điện thoại không hợp lệ',

  // File
  FILE_TOO_LARGE: 'File vượt quá giới hạn kích thước',
  INVALID_FILE_TYPE: 'Loại file không được hỗ trợ',
};

/** Get Vietnamese error message from API error code */
export function getErrorMessage(code: string | undefined, fallback?: string): string {
  if (code && errorMap[code]) return errorMap[code];
  return fallback || 'Đã có lỗi xảy ra';
}

/** Extract error from API response */
export function extractApiError(error: unknown): { code?: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    // Axios error shape
    const data = (err.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    const apiError = data?.error as Record<string, unknown> | undefined;
    if (apiError?.code) {
      return {
        code: apiError.code as string,
        message: getErrorMessage(apiError.code as string, apiError.message as string),
      };
    }
  }
  return { message: getErrorMessage(undefined) };
}
