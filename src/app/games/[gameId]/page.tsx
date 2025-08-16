"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Game {
  id: string;
  name: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  description: string | null;
  home_team_id: string | null;
  opponent_name: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  home_score: number;
  opponent_score: number;
  record_type: "team" | "personal";
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
}

interface PageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function GameDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canViewDetails, setCanViewDetails] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId, user]);

  const fetchGame = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error("試合取得エラー:", gameError);
        router.push("/dashboard");
        return;
      }

      setGame(gameData);
      setIsOwner(gameData.created_by === user?.id);

      // チーム情報を取得（存在する場合）
      if (gameData.home_team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("id, name")
          .eq("id", gameData.home_team_id)
          .single();

        if (teamData) {
          setTeam(teamData);
        }
      }

      // アクセス権限のチェック
      let hasAccess = false;
      let canEditGame = false;

      // 1. 試合作成者
      if (gameData.created_by === user?.id) {
        hasAccess = true;
        canEditGame = true;
      }

      // 2. チームメンバー/オーナーのチェック
      if (gameData.home_team_id && user) {
        // チームオーナーかチェック
        const { data: teamOwner } = await supabase
          .from("teams")
          .select("owner_id")
          .eq("id", gameData.home_team_id)
          .single();

        if (teamOwner?.owner_id === user.id) {
          hasAccess = true;
          canEditGame = true;
        } else {
          // チームメンバーかチェック
          const { data: memberCheck } = await supabase
            .from("team_members")
            .select("id")
            .eq("team_id", gameData.home_team_id)
            .eq("user_id", user.id)
            .single();

          if (memberCheck) {
            hasAccess = true;
          }
        }
      }

      // 3. 完了した試合は誰でも閲覧可能
      if (gameData.status === "completed" && gameData.is_public) {
        hasAccess = true;
      }

      // 4. 公開試合で完了していない場合はチーム関係者のみ
      if (gameData.status !== "completed" && !hasAccess) {
        setAccessError("この試合はチーム関係者のみ閲覧できます");
        setCanViewDetails(false);
      } else {
        setCanViewDetails(true);
      }

      setCanEdit(canEditGame);
    } catch (error) {
      console.error("試合取得エラー:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("本当にこの試合を削除しますか？この操作は取り消せません。")) {
      return;
    }

    try {
      const { error } = await supabase.from("games").delete().eq("id", gameId);

      if (error) {
        console.error("試合削除エラー:", error);
        alert("試合の削除に失敗しました");
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("試合削除エラー:", error);
      alert("試合の削除に失敗しました");
    }
  };

  const handleStatusChange = async (newStatus: Game["status"]) => {
    try {
      const { error } = await supabase
        .from("games")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (error) {
        console.error("ステータス更新エラー:", error);
        alert("ステータスの更新に失敗しました");
        return;
      }

      setGame((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (error) {
      console.error("ステータス更新エラー:", error);
    }
  };

  const getStatusColor = (status: Game["status"]) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: Game["status"]) => {
    switch (status) {
      case "scheduled":
        return "予定";
      case "in_progress":
        return "進行中";
      case "completed":
        return "終了";
      case "cancelled":
        return "中止";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">試合が見つかりません</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  // アクセス権限がない場合
  if (!canViewDetails) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              アクセス制限
            </h2>
            <p className="text-gray-600 mb-6">{accessError}</p>
            {!user ? (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  ログインすることで、所属チームの試合を閲覧できます
                </p>
                <Link
                  href={`/login?redirect=/games/${gameId}`}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  ログインする
                </Link>
              </div>
            ) : team ? (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  チームに参加すると、予定試合の詳細を閲覧できます
                </p>
                <Link
                  href={`/teams/${team.id}`}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  チームページへ
                </Link>
              </div>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ダッシュボードに戻る
              </Link>
            )}
          </div>
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
            href={team ? `/teams/${team.id}` : "/dashboard"}
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
            {team ? "チーム詳細に戻る" : "ダッシュボードに戻る"}
          </Link>
        </div>

        {/* 試合情報カード */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {game.name}
                </h1>
                <div className="flex items-center space-x-4 text-green-100">
                  <span className="flex items-center">
                    <svg
                      className="w-5 h-5 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {new Date(game.game_date).toLocaleDateString("ja-JP")}
                  </span>
                  {game.game_time && (
                    <span className="flex items-center">
                      <svg
                        className="w-5 h-5 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {game.game_time}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    game.status
                  )}`}
                >
                  {getStatusText(game.status)}
                </span>
                {game.record_type === "personal" && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    個人記録
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* スコアボード */}
          {(game.status === "in_progress" || game.status === "completed") && (
            <div className="bg-gray-900 text-white p-6">
              <div className="grid grid-cols-3 gap-4 items-center text-center">
                <div>
                  <div className="text-gray-400 text-sm mb-1">HOME</div>
                  <div className="text-2xl font-bold">
                    {team?.name || "ホーム"}
                  </div>
                </div>
                <div className="text-4xl font-bold">
                  <span>{game.home_score}</span>
                  <span className="mx-4 text-gray-500">-</span>
                  <span>{game.opponent_score}</span>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">AWAY</div>
                  <div className="text-2xl font-bold">{game.opponent_name}</div>
                </div>
              </div>
            </div>
          )}

          {/* 詳細情報 */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* 基本情報 */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  試合情報
                </h2>
                <dl className="space-y-3">
                  {game.location && (
                    <div>
                      <dt className="text-sm text-gray-600">場所</dt>
                      <dd className="text-gray-900 flex items-center mt-1">
                        <svg
                          className="w-4 h-4 mr-1 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {game.location}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-gray-600">対戦相手</dt>
                    <dd className="text-gray-900 mt-1">{game.opponent_name}</dd>
                  </div>
                  {team && (
                    <div>
                      <dt className="text-sm text-gray-600">チーム</dt>
                      <dd className="mt-1">
                        <Link
                          href={`/teams/${team.id}`}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {team.name}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* メモ・備考 */}
              {game.description && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    メモ・備考
                  </h2>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {game.description}
                  </p>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            {canEdit && (
              <div className="border-t pt-6">
                <div className="flex flex-wrap gap-2">
                  {/* ステータス変更ボタン */}
                  {game.status === "scheduled" && (
                    <>
                      <button
                        onClick={() => handleStatusChange("in_progress")}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        試合開始
                      </button>
                      <button
                        onClick={() => handleStatusChange("cancelled")}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        中止にする
                      </button>
                    </>
                  )}
                  {game.status === "in_progress" && (
                    <button
                      onClick={() => handleStatusChange("completed")}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      試合終了
                    </button>
                  )}

                  {/* スコア入力ボタン */}
                  {(game.status === "in_progress" ||
                    game.status === "completed") && (
                    <Link
                      href={`/games/${gameId}/score`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      スコア入力
                    </Link>
                  )}

                  {/* 編集・削除ボタン */}
                  <Link
                    href={`/games/${gameId}/edit`}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    編集
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    削除
                  </button>
                </div>
              </div>
            )}

            {/* メタ情報 */}
            <div className="mt-8 pt-6 border-t text-sm text-gray-500">
              <p>
                作成日時: {new Date(game.created_at).toLocaleString("ja-JP")}
              </p>
              <p>
                更新日時: {new Date(game.updated_at).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}