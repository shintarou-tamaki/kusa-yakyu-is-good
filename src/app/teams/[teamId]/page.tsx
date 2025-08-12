"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface PageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default function TeamDetailPage({ params }: PageProps) {
  // React.use()でparamsを解決
  const resolvedParams = use(params);
  const teamId = resolvedParams.teamId;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // ユーザーがログインしていない場合はmiddlewareが処理するため、
    // ここでのリダイレクトは不要
    if (user && teamId) {
      fetchTeam();
    }
  }, [user, teamId]);

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

      setTeam(data);
      setIsOwner(data.owner_id === user?.id);
    } catch (error) {
      console.error("チーム取得エラー:", error);
      router.push("/teams");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm("本当にこのチームを削除しますか？この操作は取り消せません。")
    ) {
      return;
    }

    try {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);

      if (error) {
        console.error("チーム削除エラー:", error);
        alert("チームの削除に失敗しました");
        return;
      }

      router.push("/teams");
    } catch (error) {
      console.error("チーム削除エラー:", error);
      alert("チームの削除に失敗しました");
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
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

        {/* チーム情報 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mr-4">
                  <span className="text-3xl font-bold text-blue-600">
                    {team.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{team.name}</h1>
                  <p className="text-blue-100 mt-1">
                    作成日:{" "}
                    {new Date(team.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </div>

              {isOwner && (
                <div className="flex space-x-2">
                  <Link
                    href={`/teams/${team.id}/edit`}
                    className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    編集
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* コンテンツ */}
          <div className="p-6">
            {/* 説明 */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                チームの説明
              </h2>
              <p className="text-gray-600">
                {team.description || "チームの説明はまだありません"}
              </p>
            </div>

            {/* アクション */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 試合を作成 */}
              <Link
                href={`/games/create?teamId=${team.id}`}
                className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg
                  className="w-8 h-8 text-green-600 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-900">試合を作成</h3>
                  <p className="text-sm text-gray-600">新しい試合を企画</p>
                </div>
              </Link>

              {/* 試合履歴 */}
              <Link
                href={`/teams/${team.id}/games`}
                className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg
                  className="w-8 h-8 text-blue-600 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-900">試合履歴</h3>
                  <p className="text-sm text-gray-600">過去の試合を見る</p>
                </div>
              </Link>

              {/* メンバー管理 */}
              {isOwner && (
                <Link
                  href={`/teams/${team.id}/members`}
                  className="flex items-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <svg
                    className="w-8 h-8 text-purple-600 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      メンバー管理
                    </h3>
                    <p className="text-sm text-gray-600">
                      メンバーを招待・管理
                    </p>
                  </div>
                </Link>
              )}
            </div>

            {/* チーム情報 */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                チーム情報
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-600">チームID</dt>
                  <dd className="text-sm font-mono text-gray-900">{team.id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">作成日時</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(team.created_at).toLocaleString("ja-JP")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">更新日時</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(team.updated_at).toLocaleString("ja-JP")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">オーナー</dt>
                  <dd className="text-sm text-gray-900">
                    {isOwner ? "あなた" : "その他のメンバー"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
