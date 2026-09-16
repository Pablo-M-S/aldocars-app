import Constants from 'expo-constants';
import { sessionStorage } from './secure-storage';
import type { ApiErrorBody } from './types';

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractMessage(body: ApiErrorBody | undefined, fallback: string): string {
  if (!body) return fallback;
  return Array.isArray(body.message) ? body.message.join(' ') : body.message ?? fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await sessionStorage.getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 401) {
      await sessionStorage.clear();
    }
    throw new ApiError(response.status, extractMessage(body, 'Não foi possível completar a ação.'));
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
