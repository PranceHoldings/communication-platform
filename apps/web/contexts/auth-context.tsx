'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, authApi } from '@/lib/api/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初期化時に認証状態をチェック
    const initAuth = async () => {
      // トークンが存在しない場合はスキップ
      if (!authApi.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      // サーバーからユーザー情報を取得
      try {
        const response = await authApi.fetchCurrentUser();
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          // 認証エラー：ローカルストレージをクリア
          authApi.logout();
          setUser(null);
        }
      } catch (error) {
        // 認証エラーは正常な動作なので、ログは出力しない
        // エラー時はローカルストレージの情報を使用
        const cachedUser = authApi.getCurrentUser();
        setUser(cachedUser);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.fetchCurrentUser();
      if (response.success && response.data) {
        setUser(response.data);
        // ローカルストレージも更新
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(response.data));
        }
      }
    } catch (error) {
      // 認証エラーは正常な動作なので、ログは出力しない
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
