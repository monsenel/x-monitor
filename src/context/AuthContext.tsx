import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api.ts';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = async () => {
    try {
      const data = await apiRequest<{ authenticated: boolean; user?: { username: string }; token?: string }>('/api/auth/status');
      if (data.authenticated && data.user) {
        if (data.token) {
          localStorage.setItem('xmonitor_token', data.token);
        }
        setIsAuthenticated(true);
        setUsername(data.user.username);
      } else {
        localStorage.removeItem('xmonitor_token');
        setIsAuthenticated(false);
        setUsername(null);
      }
    } catch {
      localStorage.removeItem('xmonitor_token');
      setIsAuthenticated(false);
      setUsername(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleUnauthorized = () => {
      localStorage.removeItem('xmonitor_token');
      setIsAuthenticated(false);
      setUsername(null);
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const login = async (user: string, pass: string) => {
    const data = await apiRequest<{ ok: boolean; user: { username: string }; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (data.ok) {
      if (data.token) {
        localStorage.setItem('xmonitor_token', data.token);
      }
      setIsAuthenticated(true);
      setUsername(data.user.username);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('xmonitor_token');
      setIsAuthenticated(false);
      setUsername(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
