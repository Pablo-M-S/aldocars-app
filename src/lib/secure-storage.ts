import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'aldocars_token';
const USER_KEY = 'aldocars_user';

/**
 * SecureStore usa Keychain (iOS) / Keystore criptografado (Android) — o
 * token nunca fica em texto puro em disco, e não é acessível a outros apps.
 * É o equivalente nativo do cookie httpOnly do site: em nenhum dos dois
 * casos o token circula por onde uma falha de XSS/JS injection alcançaria.
 */
export const sessionStorage = {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async setSession(token: string, user: unknown): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  async getUser<T>(): Promise<T | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
