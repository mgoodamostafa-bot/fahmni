// ─── Unified Error Handling Utilities ───────────────────────────

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
}

// Error codes for consistent error handling
export const ErrorCodes = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_ERROR',
  FIRESTORE: 'FIRESTORE_ERROR',
  PERMISSION: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
} as const;

// Create a standardized error object
export function createError(code: string, message: string, details?: unknown): AppError {
  return {
    code,
    message,
    details,
    timestamp: Date.now(),
  };
}

// Parse unknown error into AppError
export function parseError(error: unknown): AppError {
  if (error instanceof Error) {
    // Firebase-specific error codes
    if (error.message.includes('permission-denied')) {
      return createError(ErrorCodes.PERMISSION, 'ليس لديك صلاحية للوصول إلى هذا المحتوى', error);
    }
    if (error.message.includes('not-found')) {
      return createError(ErrorCodes.NOT_FOUND, 'البيانات المطلوبة غير موجودة', error);
    }
    if (error.message.includes('unauthenticated')) {
      return createError(ErrorCodes.AUTH, 'يجب تسجيل الدخول أولاً', error);
    }
    if (error.message.includes('network') || error.message.includes('failed')) {
      return createError(ErrorCodes.NETWORK, 'تحقق من اتصال الإنترنت وحاول مرة أخرى', error);
    }
    return createError(ErrorCodes.UNKNOWN, error.message, error);
  }

  if (typeof error === 'string') {
    return createError(ErrorCodes.UNKNOWN, error);
  }

  return createError(ErrorCodes.UNKNOWN, 'حدث خطأ غير متوقع', error);
}

// Get user-friendly Arabic error message
export function getErrorMessage(error: unknown): string {
  const appError = parseError(error);
  return appError.message;
}

// Log error to console in development
export function logError(error: unknown, context?: string) {
  if ((process.env.NODE_ENV !== 'production')) {
    const appError = parseError(error);
    console.error(`[${appError.code}] ${context || 'Error'}:`, appError.message, appError.details);
  }
}

// Safe async wrapper with error handling
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorHandler?: (error: AppError) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const appError = parseError(error);
    logError(error, 'safeAsync');
    errorHandler?.(appError);
    return fallback;
  }
}

// Toast notification helper (simple alert-based for now)
export function showErrorToast(message: string) {
  // In a real app, this would use a toast library like react-hot-toast
  console.error('[Toast Error]:', message);
}

export function showSuccessToast(message: string) {
  console.log('[Toast Success]:', message);
}
