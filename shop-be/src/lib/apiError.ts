export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

export const Errors = {
  notFound: (message = 'Khong tim thay.') => new ApiError(404, 'NOT_FOUND', message),
  unauthorized: (message = 'Vui long dang nhap.') => new ApiError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Ban khong co quyen thuc hien thao tac nay.') =>
    new ApiError(403, 'FORBIDDEN', message),
  validation: (message: string, field?: string) => new ApiError(400, 'VALIDATION_FAILED', message, field),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
};
