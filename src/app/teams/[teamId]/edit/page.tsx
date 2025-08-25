"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { prefectures, cities } from "@/lib/japanData";

interface Team {
  id: string;
  name: string;
  description: string;
  prefecture: string | null;
  city: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface PageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default function EditTeamPage({ params }: PageProps) {
  // React.use()でparamsを解決
  const resolvedParams = use(params);
  const teamId = resolvedParams.teamId;

  const [team, setTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (user && teamId) {
      fetchTeam();
    }
  }, [user, teamId]);

  // 都道府県が変更されたら市区町村リストを更新
  useEffect(() => {
    if (prefecture) {
      setAvailableCities(cities[prefecture] || []);
      // 都道府県が変更されて、現在の市区町村が新しいリストにない場合はリセット
      if (city && !cities[prefecture]?.includes(city)) {
        setCity("");
      }
    } else {
      setAvailableCities([]);
      setCity("");
    }
  }, [prefecture]);

  const fetchTeam = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (error) {
        console.error("チーム取得エラー:", error);
        router.push("/teams");
        return;
      }

      if (!data) {
        router.push("/teams");
        return;
      }

      // オーナーでない場合はリダイレクト
      if (data.owner_id !== user?.id) {
        alert("このチームを編集する権限がありません");
        router.push(`/teams/${teamId}`);
        return;
      }

      setTeam(data);
      setTeamName(data.name);
      setDescription(data.description || "");
      setPrefecture(data.prefecture || "");
      setCity(data.city || "");
      
      // 既存の都道府県がある場合は市区町村リストを設定
      if (data.prefecture) {
        setAvailableCities(cities[data.prefecture] || []);
      }
    } catch (error) {
      console.error("チーム取得エラー:", error);
      router.push("/teams");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      setError("チーム名を入力してください");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name: teamName.trim(),
          description: description.trim() || null,
          prefecture: prefecture || null,
          city: city || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", teamId);

      if (updateError) {
        console.error("チーム更新エラー:", updateError);
        setError("チームの更新に失敗しました");
        return;
      }

      // 更新成功後、チーム詳細ページへリダイレクト
      router.push(`/teams/${teamId}`);
    } catch (error) {
      console.error("チーム更新エラー:", error);
      setError("チームの更新に失敗しました");
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

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">チームが見つかりません</p>
          <Link href="/teams" className="text-blue-600 hover:text-blue-700">
            チーム一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link
            href={`/teams/${teamId}`}
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
            チーム詳細に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            チーム情報を編集
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* チーム名 */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: 草野球チーム太陽"
                maxLength={50}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                {teamName.length}/50文字
              </p>
            </div>

            {/* 説明 */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="チームの特徴や活動内容を入力してください"
                rows={4}
                maxLength={200}
              />
              <p className="mt-1 text-sm text-gray-500">
                {description.length}/200文字
              </p>
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

            {/* チーム情報 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                チーム情報
              </h3>
              <dl className="text-sm space-y-1">
                <div className="flex">
                  <dt className="text-gray-600 w-24">作成日:</dt>
                  <dd className="text-gray-900">
                    {new Date(team.created_at).toLocaleDateString("ja-JP")}
                  </dd>
                </div>
                <div className="flex">
                  <dt className="text-gray-600 w-24">更新日:</dt>
                  <dd className="text-gray-900">
                    {new Date(team.updated_at).toLocaleDateString("ja-JP")}
                  </dd>
                </div>
              </dl>
            </div>

            {/* ボタン */}
            <div className="flex justify-end space-x-4">
              <Link
                href={`/teams/${teamId}`}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={saving || !teamName.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    保存中...
                  </span>
                ) : (
                  "変更を保存"
                )}
              </button>
            </div>
          </form>

          {/* 削除セクション */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-red-600 mb-2">
              危険な操作
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              チームを削除すると、関連するすべてのデータが失われます。この操作は取り消せません。
            </p>
            <button
              onClick={() => {
                if (
                  confirm(
                    "本当にこのチームを削除しますか？この操作は取り消せません。"
                  )
                ) {
                  // 削除処理
                  supabase
                    .from("teams")
                    .delete()
                    .eq("id", teamId)
                    .then(({ error }) => {
                      if (error) {
                        alert("チームの削除に失敗しました");
                      } else {
                        router.push("/teams");
                      }
                    });
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              チームを削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}