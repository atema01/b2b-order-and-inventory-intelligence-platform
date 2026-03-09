import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { clearToken, getToken, setToken } from '../storage/token';

interface UserPayload {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  companyName?: string;
  tier?: string;
  permissions?: Record<string, boolean>;
}

interface AuthContextType {
  user: UserPayload | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = await getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setTokenState(storedToken);
      const me = await apiRequest<UserPayload>('/api/auth/me', { token: storedToken });
      if (me.ok && me.data) {
        setUser(me.data);
      } else {
        await clearToken();
        setTokenState(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const result = await apiRequest<{ token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!result.ok || !result.data?.token) {
      setIsLoading(false);
      return { success: false, error: result.error || 'Login failed' };
    }

    await setToken(result.data.token);
    setTokenState(result.data.token);

    const me = await apiRequest<UserPayload>('/api/auth/me', { token: result.data.token });
    if (me.ok && me.data) {
      setUser(me.data);
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return { success: false, error: me.error || 'Failed to load profile' };
  };

  const logout = async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
    await apiRequest('/api/auth/logout', { method: 'POST' });
  };

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
