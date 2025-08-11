'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LogoutButton from './LogoutButton';
import type { User } from '@supabase/supabase-js';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClientComponentClient();
    
    // 現在のユーザーを取得
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('ユーザー取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="bg-white shadow-sm border-b">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴ・サイト名 */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-gray-700">
              ⚾️ 草野球スコア
            </Link>
          </div>
          
          {/* ナビゲーションメニュー */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/search/teams" className="text-gray-600 hover:text-gray-900">
              チーム検索
            </Link>
            <Link href="/search/games" className="text-gray-600 hover:text-gray-900">
              試合検索
            </Link>
            {user && (
              <>
                <Link href="/teams" className="text-gray-600 hover:text-gray-900">
                  マイチーム
                </Link>
                <Link href="/games" className="text-gray-600 hover:text-gray-900">
                  試合管理
                </Link>
              </>
            )}
          </div>

          {/* ユーザーメニュー */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="text-gray-400">読み込み中...</div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user.email}
                </span>
                <LogoutButton />
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}