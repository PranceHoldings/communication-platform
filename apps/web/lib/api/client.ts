/**
 * API Client for Prance Platform
 *
 * CRITICAL: Uses StandardAPIResponse from @prance/shared
 * This ensures type safety between Frontend (caller) and Lambda (callee)
 */

import type { StandardAPIResponse } from '@prance/shared';
import { isSuccessResponse } from '@prance/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// デバッグ: API URL確認
console.log('[API Client] Base URL:', API_BASE_URL);


class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<StandardAPIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // トークンがあれば追加
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // デバッグログ
    console.log('[API Client] Request:', {
      url,
      method: options.method || 'GET',
      hasToken: !!token,
      headers: Object.keys(headers),
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit',
      });

      console.log('[API Client] Response:', {
        url,
        status: response.status,
        ok: response.ok,
      });

      const data = (await response.json()) as StandardAPIResponse<T>;

      if (!response.ok) {
        return {
          success: false,
          error: (data as any).error || {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred',
          },
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error occurred',
        },
      };
    }
  }

  async get<T>(endpoint: string): Promise<StandardAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<StandardAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<StandardAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<StandardAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<StandardAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // トークン管理
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', token);
  }

  removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  /**
   * Unwrap API response and throw error if not successful
   * Reduces boilerplate in API functions
   */
  unwrapResponse<T>(response: StandardAPIResponse<T>): T {
    if (!isSuccessResponse(response)) {
      throw new Error(response.error.message || 'Request failed');
    }
    return response.data;
  }

  /**
   * Unwrap API response for void/delete operations
   */
  unwrapVoidResponse(response: StandardAPIResponse<any>): void {
    if (!isSuccessResponse(response)) {
      throw new Error(response.error.message || 'Request failed');
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
