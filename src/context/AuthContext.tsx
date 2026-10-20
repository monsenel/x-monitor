import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api.ts';

export interface UserProfile {
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserState: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
  updateUserState: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeUser = (u: any): UserProfile => ({
    username: u?.username || 'admin',
    displayName: u?.displayName || u?.username || 'Admin User',
    email: u?.email || 'admin@xmonitor.io',
    avatarUrl: u?.avatarUrl || '',
  });

  const checkStatus = async () => {
    try {
      const data = await apiRequest<{
        authenticated: boolean;
        user?: UserProfile;
        token?: string;
      }>('/api/auth/status');
      if (data.authenticated && data.user) {
        if (data.token) {
          localStorage.setItem('xmonitor_token', data.token);
        }
        setIsAuthenticated(true);
        setUser(normalizeUser(data.user));
      } else {
        localStorage.removeItem('xmonitor_token');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('xmonitor_token');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleUnauthorized = () => {
      localStorage.removeItem('xmonitor_token');
      setIsAuthenticated(false);
      setUser(null);
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const login = async (usernameInput: string, pass: string) => {
    const data = await apiRequest<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: usernameInput, password: pass }),
    });
    if (data.ok) {
      if (data.token) {
        localStorage.setItem('xmonitor_token', data.token);
      }
      setIsAuthenticated(true);
      setUser(normalizeUser(data.user));
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('xmonitor_token');
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/profile');
      if (data.user) {
        setUser(normalizeUser(data.user));
      }
    } catch {}
  };

  const updateUserState = (updated: UserProfile) => {
    setUser(normalizeUser(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username: user?.username || null,
        user,
        isLoading,
        login,
        logout,
        refreshProfile,
        updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

