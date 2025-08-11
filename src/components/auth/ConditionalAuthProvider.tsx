"use client";

import { usePathname } from 'next/navigation';
import { AuthProvider } from './AuthProvider';
import { Header } from '@/components/layout/Header';

// 認証が不要なページのリスト
const PUBLIC_PAGES = [
  '/',
  '/search/games',
  '/search/teams',
  '/login'
];

// 認証が必要なページのリスト
const AUTH_REQUIRED_PAGES = [
  '/dashboard',
  '/create-game',
  '/teams',
  '/games'
];

export function ConditionalAuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // 現在のパスが認証不要ページかチェック
  const isPublicPage = PUBLIC_PAGES.includes(pathname) || 
                      pathname.startsWith('/search/') ||
                      pathname.startsWith('/auth/');
  
  // 認証不要ページの場合は、AuthProviderなしで表示
  if (isPublicPage) {
    return (
      <>
        <PublicHeader />
        {children}
      </>
    );
  }
  
  // 認証が必要なページの場合のみAuthProviderを使用
  return (
    <AuthProvider>
      <Header />
      {children}
    </AuthProvider>
  );
}