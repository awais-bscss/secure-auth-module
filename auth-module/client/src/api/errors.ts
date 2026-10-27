import axios from 'axios';

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isCancelled(error: unknown): boolean {
  if (axios.isCancel(error)) {
    return true;
  }
  if (error instanceof AppError && error.code === 'REQUEST_CANCELLED') {
    return true;
  }
  if (error && typeof error === 'object' && 'name' in error) {
    const errName = (error as { name?: string }).name;
    if (errName === 'CanceledError' || errName === 'AbortError') {
      return true;
    }
  }
  return false;
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (axios.isCancel(error)) {
    return new AppError(0, 'REQUEST_CANCELLED', 'Request was cancelled');
  }

  if (axios.isAxiosError(error)) {
    // Timeout
    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return new AppError(0, 'TIMEOUT', 'The request timed out. Please try again.');
    }

    // Network error (no response)
    if (!error.response) {
      return new AppError(0, 'NETWORK_ERROR', 'Network error. Please check your internet connection.');
    }

    const { status, data } = error.response;
    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      const serverCode = String(data.code || 'UNKNOWN_ERROR');
      const serverMessage = String(data.message || 'An unexpected server error occurred.');
      return new AppError(status, serverCode, serverMessage);
    }

    return new AppError(
      status,
      `HTTP_${status}`,
      error.response.statusText || 'An unexpected HTTP error occurred.'
    );
  }

  if (error instanceof Error) {
    return new AppError(500, 'UNEXPECTED_ERROR', error.message);
  }

  return new AppError(500, 'UNKNOWN_ERROR', 'An unknown error occurred.');
}
