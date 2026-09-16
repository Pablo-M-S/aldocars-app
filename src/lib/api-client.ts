import Constants from 'expo-constants';
import { sessionStorage } from './secure-storage';
import type { ApiErrorBody } from './types';

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';

/**
 * O api-client não conhece o AuthContext (evita import circular), mas precisa
 * avisar a aplicação quando um 401 invalida a sessão — sem isso, a tela fica
 * presa em estado "autenticado" (token já apagado do SecureStore, mas o
 * estado React `user` continua populado) até o usuário fechar e reabrir o
 * app. O AuthProvider registra esse handler ao montar.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

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
      onUnauthorized?.();
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
