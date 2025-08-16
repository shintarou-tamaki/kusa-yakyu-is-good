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
  opponent_name: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  home_score: number;
  opponent_score: number;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
}

interface PageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default function TeamGamesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const teamId = resolvedParams.teamId;

  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">(
    "all"
  );
  const [isTeamMember, setIsTeamMember] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (teamId) {
      fetchTeamAndGames();
    }
  }, [teamId, user]);

  const fetchTeamAndGames = async () => {
    try {
      // チーム情報を取得
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamError || !teamData) {
        console.error("チーム取得エラー:", teamError);
        router.push("/teams");
        return;
      }

      setTeam(teamData);

      // ユーザーがチームメンバーかチェック
      let memberStatus = false;
      if (user) {
        const { data: memberData } = await supabase
          .from("team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("user_id", user.id)
          .single();

        memberStatus = !!memberData || teamData.owner_id === user.id;
      }
      setIsTeamMember(memberStatus);

      // チームの試合を取得
      let query = supabase
        .from("games")
        .select("*")
        .eq("home_team_id", teamId)
        .order("game_date", { ascending: false });

      // チーム関係者以外は完了した試合のみ取得
      if (!memberStatus) {
        query = query.eq("status", "completed");
      }

      const { data: gamesData, error: gamesError } = await query;

      if (gamesError) {
        console.error("試合取得エラー:", gamesError);
        setGames([]);
      } else {
        setGames(gamesData || []);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredGames = () => {
    switch (filter) {
      case "scheduled":
        return games.filter((game) => game.status === "scheduled");
      case "completed":
        return games.filter((game) => game.status === "completed");
      default:
        return games;
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

  const getGameResult = (game: Game) => {
    if (game.status !== "completed") return null;

    const homeWin = game.home_score > game.opponent_score;
    const draw = game.home_score === game.opponent_score;

    if (draw) {
      return <span className="text-gray-600 font-semibold">引き分け</span>;
    }
    return homeWin ? (
      <span className="text-blue-600 font-semibold">勝利</span>
    ) : (
      <span className="text-red-600 font-semibold">敗北</span>
    );
  };

  const stats = {
    total: games.length,
    completed: games.filter((g) => g.status === "completed").length,
    wins: games.filter(
      (g) => g.status === "completed" && g.home_score > g.opponent_score
    ).length,
    losses: games.filter(
      (g) => g.status === "completed" && g.home_score < g.opponent_score
    ).length,
    draws: games.filter(
      (g) => g.status === "completed" && g.home_score === g.opponent_score
    ).length,
    scheduled: games.filter((g) => g.status === "scheduled").length,
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

  const filteredGames = getFilteredGames();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
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

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {team.name} の試合履歴
              </h1>
              <p className="text-gray-600 mt-1">
                {isTeamMember ? `全 ${games.length} 試合` : `完了試合 ${games.length} 試合`}
              </p>
            </div>
            {/* ログイン時のみ試合作成ボタンを表示 */}
            {user && isTeamMember && (
              <Link
                href={`/games/create?teamId=${teamId}`}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                新しい試合を作成
              </Link>
            )}
          </div>
        </div>

        {/* メンバー以外への注意表示 */}
        {!isTeamMember && !loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold">閲覧制限のお知らせ</p>
                <p>
                  チームメンバー以外の方は、完了した試合のみ閲覧できます。
                </p>
                {user ? (
                  <p>
                    チームに参加すると、すべての試合情報を閲覧できるようになります。
                  </p>
                ) : (
                  <p>
                    ログインしてチームに参加すると、すべての試合情報を閲覧できるようになります。
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {isTeamMember ? stats.total : stats.completed}
            </div>
            <div className="text-sm text-gray-600">
              {isTeamMember ? "全試合" : "公開試合"}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.completed}
            </div>
            <div className="text-sm text-gray-600">完了</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.wins}</div>
            <div className="text-sm text-gray-600">勝利</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.losses}
            </div>
            <div className="text-sm text-gray-600">敗北</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {stats.draws}
            </div>
            <div className="text-sm text-gray-600">引分</div>
          </div>
          {isTeamMember && (
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.scheduled}
              </div>
              <div className="text-sm text-gray-600">予定</div>
            </div>
          )}
        </div>

        {/* フィルター（メンバーのみ表示） */}
        {isTeamMember && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-4 border-b">
              <div className="flex space-x-4">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  すべて ({games.length})
                </button>
                <button
                  onClick={() => setFilter("scheduled")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "scheduled"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  予定 ({stats.scheduled})
                </button>
                <button
                  onClick={() => setFilter("completed")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "completed"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  終了 ({stats.completed})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 試合リスト */}
        <div className="bg-white rounded-lg shadow">
          {filteredGames.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">
                {!isTeamMember
                  ? "完了した試合がまだありません"
                  : filter === "all"
                  ? "試合がまだありません"
                  : `${
                      filter === "scheduled" ? "予定" : "終了"
                    }した試合がありません`}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredGames.map((game) => (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {game.name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            game.status
                          )}`}
                        >
                          {getStatusText(game.status)}
                        </span>
                        {getGameResult(game)}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
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
                          {game.game_time && ` ${game.game_time}`}
                        </div>

                        <div className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          vs {game.opponent_name}
                        </div>

                        {game.location && (
                          <div className="flex items-center">
                            <svg
                              className="w-4 h-4 mr-1"
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
                            </svg>
                            {game.location}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* スコア表示 */}
                    {game.status === "completed" && (
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold">
                          <span
                            className={
                              game.home_score > game.opponent_score
                                ? "text-blue-600"
                                : "text-gray-900"
                            }
                          >
                            {game.home_score}
                          </span>
                          <span className="mx-2 text-gray-400">-</span>
                          <span
                            className={
                              game.opponent_score > game.home_score
                                ? "text-red-600"
                                : "text-gray-900"
                            }
                          >
                            {game.opponent_score}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}