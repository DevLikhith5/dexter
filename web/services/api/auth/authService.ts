// services/api/auth/authService.ts
import { makeRequest } from '../utils/requestHandler';
import { API_BASE_URL } from '../config';
import { User } from '../../../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
  refreshToken?: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return makeRequest<AuthResponse>('/users/login', {
      method: 'POST',
      body: credentials,
      authenticated: false,
    });
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    return makeRequest<AuthResponse>('/users/register', {
      method: 'POST',
      body: userData,
      authenticated: false,
    });
  }

  async googleLogin(code: string): Promise<AuthResponse> {
    return makeRequest<AuthResponse>('/auth/google', {
      method: 'POST',
      body: { code },
      authenticated: false,
    });
  }

  async getProfile(): Promise<{ user: User }> {
    return makeRequest<{ user: User }>('/users/me', {
      method: 'GET',
      authenticated: true,
    });
  }

  logout(): void {
    // Clear any local storage and make a request to invalidate the session
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('accessToken');
    // Make a request to the backend to clear the HTTP-only cookie
    fetch(`${API_BASE_URL}/users/logout`, {
      method: 'POST',
      credentials: 'include' // Include cookies in the request
    }).catch(() => {
      // Ignore errors during logout
    });
  }

  async updateProfile(data: { username?: string, email?: string, bio?: string }): Promise<{ message: string, user: User }> {
    return makeRequest<{ message: string, user: User }>('/users/me', {
      method: 'PUT',
      body: data,
      authenticated: true,
    });
  }

  async updateAvatar(avatarUrl: string): Promise<{ message: string, user: User }> {
    return makeRequest<{ message: string, user: User }>('/users/me/avatar', {
      method: 'POST',
      body: { avatarUrl },
      authenticated: true,
    });
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      // Try to refresh the token if needed
      const token = await this.getValidToken();
      return !!token;
    } catch {
      return false;
    }
  }

  async getValidToken(): Promise<string | null> {
    // First check if we have a token in sessionStorage
    let token = sessionStorage.getItem('accessToken');

    if (!token) {
      // If not, try to get a new one using the refresh token
      token = await this.refreshAccessToken();
    }

    return token;
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/refresh`, {
        method: 'POST',
        credentials: 'include', // Include cookies in the request
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store the new access token in sessionStorage
        sessionStorage.setItem('accessToken', data.accessToken);
        return data.accessToken;
      } else {
        // If refresh fails, clear the refresh token
        localStorage.removeItem('refreshToken');
        return null;
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      localStorage.removeItem('refreshToken');
      return null;
    }
  }

  setTokens(accessToken: string, refreshToken: string): void {
    // Store access token in sessionStorage (short-lived, cleared when tab closes)
    sessionStorage.setItem('accessToken', accessToken);
    // Store refresh token in localStorage (longer-lived)
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export const authService = new AuthService();