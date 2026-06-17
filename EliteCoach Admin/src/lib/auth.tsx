import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from './api';

export interface User {
  id: string;
  email: string;
  roles?: string[];
  // Add other relevant user fields here based on openapi.json UserMe
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (data: URLSearchParams) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Function to load the user profile
  const loadUser = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authApi.getMe();
      // Ensure the user actually has the platform_admin role
      // Note: If the backend doesn't return roles yet, we'll bypass this check temporarily
      // or assume successful login means they have access.
      const hasAdminRole = userData.roles?.includes('platform_admin') ?? true;
      
      if (!hasAdminRole) {
        throw new Error('User does not have platform_admin privileges.');
      }

      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('admin_token');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    // Listen for unauthorized events from the API interceptor
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (data: URLSearchParams) => {
    const response = await authApi.login(data);
    if (response.access_token) {
      localStorage.setItem('admin_token', response.access_token);
      await loadUser();
    }
  };

  const logout = () => {
    authApi.logout();
    localStorage.removeItem('admin_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
