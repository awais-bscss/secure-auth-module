import { apiClient, refreshClient, executeTokenRefresh } from './client';
import { setAccessToken, clearAccessToken } from './tokenStore';
import { normalizeError } from './errors';

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    setAccessToken(response.data.accessToken);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function refresh(): Promise<string> {
  return executeTokenRefresh();
}

export async function logout(): Promise<void> {
  try {
    await refreshClient.post('/auth/logout');
  } catch (error) {
    // Ignore network/server errors during logout
  } finally {
    clearAccessToken();
  }
}

export async function me(): Promise<User> {
  try {
    const response = await apiClient.get<{ user: User }>('/auth/me');
    return response.data.user;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getUsers(signal?: AbortSignal): Promise<User[]> {
  try {
    const response = await apiClient.get<User[]>('/users', { signal });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    await apiClient.delete(`/users/${id}`);
  } catch (error) {
    throw normalizeError(error);
  }
}
