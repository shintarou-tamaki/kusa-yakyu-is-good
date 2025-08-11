'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      // Supabaseクライアントを作成
      const supabase = createClientComponentClient();
      
      // ログアウト処理
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('ログアウトエラー:', error);
        alert('ログアウトに失敗しました。もう一度お試しください。');
        return;
      }

      // ブラウザのストレージをクリア（念のため）
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // ホームページにリダイレクトしてページをリフレッシュ
      router.push('/');
      router.refresh();
      
    } catch (error) {
      console.error('ログアウト処理エラー:', error);
      alert('ログアウトに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'ログアウト中...' : 'ログアウト'}
    </button>
  );
}