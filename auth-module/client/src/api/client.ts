import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore';
import { normalizeError, AppError } from './errors';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Refresh client with CSRF header
export const refreshClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 10000,
});

// Primary API client
export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

// Refresh mutex and failure callback
let refreshPromise: Promise<string> | null = null;
let onAuthFailureCallback: (() => void) | null = null;

export function setOnAuthFailure(callback: () => void): void {
  onAuthFailureCallback = callback;
}

export function executeTokenRefresh(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const hadSession = getAccessToken() !== null;
    try {
      const response = await refreshClient.post<{ accessToken: string }>('/auth/refresh');
      const newToken = response.data.accessToken;
      setAccessToken(newToken);
      return newToken;
    } catch (error) {
      const is401 = axios.isAxiosError(error) && error.response?.status === 401;
      if (is401) {
        clearAccessToken();
        if (hadSession && onAuthFailureCallback) {
          onAuthFailureCallback();
        }
      }
      throw normalizeError(error);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Attach access token to outgoing requests
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error))
);

// Handle 401 with single-flight refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const url = originalRequest?.url || '';
    const isAuthLoginOrRefresh = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthLoginOrRefresh
    ) {
      // Skip refresh if unauthenticated
      if (!getAccessToken()) {
        return Promise.reject(normalizeError(error));
      }

      originalRequest._retry = true;

      try {
        const newAccessToken = await executeTokenRefresh();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr instanceof AppError ? refreshErr : normalizeError(refreshErr));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);
