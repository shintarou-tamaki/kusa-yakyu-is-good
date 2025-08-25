"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { prefectures, cities } from "@/lib/japanData";

export default function CreateTeamPage() {
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
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

  // 都道府県が変更されたら市区町村リストを更新
  useEffect(() => {
    if (prefecture) {
      setAvailableCities(cities[prefecture] || []);
      setCity(""); // 都道府県が変更されたら市区町村をリセット
    } else {
      setAvailableCities([]);
      setCity("");
    }
  }, [prefecture]);

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
            prefecture: prefecture || null,
            city: city || null,
            owner_id: user.id,
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

      // チーム作成成功後、オーナーをメンバーとして追加
      if (data) {
        // オーナーをteam_membersに追加（トリガーが動作しない場合のバックアップ）
        const { error: memberError } = await supabase
          .from("team_members")
          .insert({
            team_id: data.id,
            user_id: user.id,
            role: 'owner',
            joined_at: new Date().toISOString()
          });

        if (memberError) {
          console.log("オーナー追加エラー（トリガーで処理済みの可能性）:", memberError);
        }

        // 作成成功後、チーム詳細ページへリダイレクト
        router.push(`/teams/${data.id}`);
      }
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

            {/* 主な活動地域 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                主な活動地域
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prefecture"
                    className="block text-xs text-gray-600 mb-1"
                  >
                    都道府県
                  </label>
                  <select
                    id="prefecture"
                    value={prefecture}
                    onChange={(e) => setPrefecture(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {prefectures.map((pref) => (
                      <option key={pref} value={pref}>
                        {pref}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="city"
                    className="block text-xs text-gray-600 mb-1"
                  >
                    市区町村
                  </label>
                  <select
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!prefecture}
                  >
                    <option value="">
                      {prefecture ? "選択してください" : "都道府県を先に選択"}
                    </option>
                    {availableCities.map((cityName) => (
                      <option key={cityName} value={cityName}>
                        {cityName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                チームの主な活動地域を設定すると、近くのチームを探しやすくなります
              </p>
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