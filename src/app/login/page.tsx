"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // 初回マウント時に認証状態をチェック
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    };

    checkAuth();

    // 認証状態の変更を監視（ログイン成功時に即座にリダイレクト）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);
      if (event === 'SIGNED_IN' && session) {
        console.log("ログイン成功、ダッシュボードへリダイレクト");
        router.push("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account'  // 毎回アカウント選択画面を表示
          }
        },
      });

      if (error) {
        console.error("ログインエラー:", error);
        alert("ログインに失敗しました");
        setLoading(false);
      }
      // 成功時はloadingをtrueのままにして、リダイレクトを待つ
    } catch (error) {
      console.error("ログインエラー:", error);
      alert("ログインに失敗しました");
      setLoading(false);
    }
  };

  // 認証状態チェック中
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            草野球 is Good
          </h1>
          <p className="text-gray-600">
            チーム管理・試合記録アプリケーション
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-3"></div>
                ログイン中...
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Googleアカウントでログイン
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>ログインすることで、以下の機能が利用できます：</p>
          <ul className="mt-3 space-y-1">
            <li>• チームの作成・管理</li>
            <li>• 試合の記録・スコア入力</li>
            <li>• チームへの参加申請</li>
          </ul>
        </div>
      </div>
    </div>
  );
}