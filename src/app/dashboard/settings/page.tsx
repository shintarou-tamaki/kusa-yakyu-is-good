"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("プロフィール取得エラー:", error);
      }

      if (data) {
        setDisplayName(data.display_name || "");
        setOriginalName(data.display_name || "");
      }
    } catch (error) {
      console.error("プロフィール取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

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

    if (displayName === originalName) {
      setError("変更がありません");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("user_profiles")
        .upsert({
          id: user?.id,
          display_name: displayName.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error("更新エラー:", updateError);
        setError("更新に失敗しました");
        return;
      }

      setOriginalName(displayName);
      setMessage("ユーザー名を更新しました");
      
      // 3秒後にメッセージを消す
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("エラー:", error);
      setError("予期しないエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            ダッシュボードに戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            アカウント設定
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* メールアドレス（読み取り専用） */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={user?.email || ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                disabled
              />
            </div>

            {/* ユーザー名 */}
            <div className="mb-6">
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                ユーザー名（ニックネーム）
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 野球太郎"
                maxLength={20}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                2〜20文字で入力してください
              </p>
            </div>

            {/* ボタン */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !displayName.trim() || displayName === originalName}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "変更を保存"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}