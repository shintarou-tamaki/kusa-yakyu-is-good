"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../auth/AuthProvider";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴ・ナビゲーション */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">⚾️</span>
              <span className="text-xl font-bold text-gray-900">
                草野球 is Good
              </span>
            </Link>

            <nav className="hidden md:flex space-x-6">
              <Link
                href="/search/games"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                試合検索
              </Link>
              <Link
                href="/search/teams"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                チーム検索
              </Link>
              {user && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    ダッシュボード
                  </Link>
                  <Link
                    href="/teams"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    マイチーム
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* ユーザーメニュー */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                {profile?.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || ""}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                  {profile?.display_name || user.email?.split("@")[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  ログイン
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
