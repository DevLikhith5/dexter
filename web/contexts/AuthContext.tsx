// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: (() => Promise<string | null>) | null;
  login: (email: string, password: string) => Promise<any>;
  googleLogin: (code: string) => Promise<any>;
  register: (username: string, email: string, password: string) => Promise<any>;
  logout: () => void;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticatedState, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in on app start
    const initializeAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          try {
            const response = await authService.getProfile();
            setUser(response.user);
            setIsAuthenticated(true);
          } catch (error) {
            console.error('Error fetching profile:', error);
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      // Set tokens from the response
      authService.setTokens(response.token, response.refreshToken || '');
      setUser(response.user);
      setIsAuthenticated(true); // Update the auth state
      return response;
    } catch (error: any) {
      // Error will be handled by the calling component
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (code: string) => {
    setIsLoading(true);
    try {
      const response = await authService.googleLogin(code);

      authService.setTokens(response.token, response.refreshToken || '');
      setUser(response.user);
      console.log("USER FROM GOOLGE LOGIN: ",response)
      setIsAuthenticated(true); 
      return response;
    } catch (error: any) {
      // Error will be handled by the calling component
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.register({ username, email, password });
      // Set tokens from the response
      authService.setTokens(response.token, response.refreshToken || '');
      setUser(response.user);
      setIsAuthenticated(true); // Update the auth state
      return response;
    } catch (error: any) {
      // Error will be handled by the calling component
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false); // Update the auth state
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    token: () => authService.getValidToken(),
    login,
    googleLogin,
    register,
    logout,
    updateUser,
    isAuthenticated: isAuthenticatedState,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};