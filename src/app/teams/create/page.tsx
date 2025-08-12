"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateTeamPage() {
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // middlewareが認証を処理するため、ここでのチェックは簡略化
    if (!user) {
      console.log("ユーザー未認証");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("ログインが必要です");
      return;
    }

    if (!teamName.trim()) {
      setError("チーム名を入力してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // membersカラムを除外してチームを作成
      const { data, error: createError } = await supabase
        .from("teams")
        .insert([
          {
            name: teamName.trim(),
            description: description.trim() || null,
            owner_id: user.id,
            // membersカラムは一旦除外
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("チーム作成エラー:", createError);
        setError(`エラー: ${createError.message}`);
        return;
      }

      console.log("チーム作成成功:", data);

      // 作成成功後、チーム詳細ページへリダイレクト
      router.push(`/teams/${data.id}`);
    } catch (error) {
      console.error("予期しないエラー:", error);
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/teams"
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
            チーム一覧に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            新しいチームを作成
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="teamName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                チーム名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 草野球チーム太陽"
                maxLength={50}
                required
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                チームの説明
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="チームの特徴や活動内容を入力してください"
                rows={4}
                maxLength={200}
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Link
                href="/teams"
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={loading || !teamName.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "作成中..." : "チームを作成"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
