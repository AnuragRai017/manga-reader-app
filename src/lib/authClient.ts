import type { UserResponse } from '../types/user';

export interface AuthResponse {
  user: UserResponse;
  token: string;
}

export interface AuthError {
  message: string;
  details?: Record<string, string | null>;
}

async function handleAuthResponse(response: Response): Promise<AuthResponse> {
  const data = await response.json();
  
  if (!response.ok) {
    const error: AuthError = {
      message: data.message || 'Authentication failed',
      details: data.details
    };
    throw error;
  }

  // Store auth data
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return handleAuthResponse(response);
}

export async function signup(username: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password }),
  });

  return handleAuthResponse(response);
}

export async function logout(): Promise<void> {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to request password reset');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await fetch('/api/auth/reset-password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reset password');
  }
}

export function getCurrentUser(): UserResponse | null {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
} 