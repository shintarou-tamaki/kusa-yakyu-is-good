"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SetupPage() {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // ログインしていない場合はログインページへ
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      setError("ユーザー名を入力してください");
      return;
    }

    if (displayName.length < 2 || displayName.length > 20) {
      setError("ユーザー名は2文字以上20文字以内で入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // user_profilesを更新または作成
      const { error: upsertError } = await supabase
        .from("user_profiles")
        .upsert({
          id: user?.id,
          display_name: displayName.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error("プロフィール更新エラー:", upsertError);
        setError("プロフィールの更新に失敗しました");
        return;
      }

      // ダッシュボードへリダイレクト
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("エラー:", error);
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900">
            ようこそ！
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            まずはユーザー名を設定してください
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              ユーザー名（ニックネーム）
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="例: 野球太郎"
              maxLength={20}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              2〜20文字で入力してください。後から変更できます。
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !displayName.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "設定中..." : "設定を完了"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}