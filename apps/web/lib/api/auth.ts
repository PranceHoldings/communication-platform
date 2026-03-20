import type { User } from '@prance/shared';
/**
 * Authentication API
 */

import { apiClient } from './client';

// Re-export User type for convenience
export type { User };

// API Response wrapper type
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export const authApi = {
  /**
   * ユーザー登録
   */
  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/auth/register', data);
  },

  /**
   * ログイン
   */
  async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/auth/login', data);
  },

  /**
   * ログアウト
   */
  logout(): void {
    apiClient.removeToken();
  },

  /**
   * 現在のユーザーを取得
   */
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;

    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  },

  /**
   * 認証状態をチェック
   */
  isAuthenticated(): boolean {
    return !!apiClient.getToken() && !!this.getCurrentUser();
  },

  /**
   * 認証情報を保存
   */
  saveAuthData(user: User, tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * サーバーから現在のユーザー情報を取得
   */
  async fetchCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/users/me');
  },
};

/**
 * 現在の認証トークンを取得
 */
export function getAuthToken(): string | null {
  return apiClient.getToken();
}
