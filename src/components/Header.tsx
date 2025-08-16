"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Header() {
  const { user, loading, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("ログアウトエラー:", error);
      alert("ログアウトに失敗しました。");
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              href={user ? "/dashboard" : "/"}
              className="text-xl font-bold text-gray-900 hover:text-gray-700"
            >
              ⚾️ 草野球 is Good
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  ダッシュボード
                </Link>
                <Link
                  href="/teams"
                  className="text-gray-600 hover:text-gray-900"
                >
                  マイチーム
                </Link>
                <Link
                  href="/games"
                  className="text-gray-600 hover:text-gray-900"
                >
                  試合管理
                </Link>
              </>
            )}
            <Link
              href="/search/teams"
              className="text-gray-600 hover:text-gray-900"
            >
              チーム検索
            </Link>
            <Link
              href="/search/games"
              className="text-gray-600 hover:text-gray-900"
            >
              試合検索
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="text-gray-400">読み込み中...</div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  ログアウト
                </button>
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