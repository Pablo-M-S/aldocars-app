import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { api, setUnauthorizedHandler } from './api-client';
import { sessionStorage } from './secure-storage';
import type { AuthResponse, AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    sessionStorage.getUser<AuthUser>().then((storedUser) => {
      setUser(storedUser);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    // Qualquer 401 vindo da API (token expirado, revogado, etc.) já limpa o
    // SecureStore dentro do api-client; aqui só precisamos sincronizar o
    // estado React e tirar o usuário da área autenticada.
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace('/(auth)/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const login = async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    await sessionStorage.setSession(response.accessToken, response.user);
    setUser(response.user);
    router.replace('/(tabs)');
  };

  const logout = async () => {
    await sessionStorage.clear();
    setUser(null);
    router.replace('/(auth)/login');
  };

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider.');
  }
  return context;
}
