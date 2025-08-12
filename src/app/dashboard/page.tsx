"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Game {
  id: string;
  name: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  opponent_name: string;
  status: string;
  home_score: number;
  opponent_score: number;
  home_team_id: string | null;
  created_at: string;
}

interface Stats {
  totalTeams: number;
  totalGames: number;
  upcomingGames: number;
  completedGames: number;
}

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTeams: 0,
    totalGames: 0,
    upcomingGames: 0,
    completedGames: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    console.log("ユーザーID:", user.id); // デバッグ用

    try {
      // チーム情報を取得
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      console.log("取得したチーム:", teamsData); // デバッグ用

      if (teamsError) {
        console.error("チーム取得エラー:", teamsError);
      } else {
        setTeams(teamsData || []);
      }

      // 試合情報を取得（自分が作成した試合、または自分のチームの試合）
      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("*")
        .or(`created_by.eq.${user.id}`)
        .order("game_date", { ascending: true });

      console.log("取得した試合:", gamesData); // デバッグ用

      if (gamesError) {
        console.error("試合取得エラー:", gamesError);
      } else {
        setGames(gamesData || []);

        // 統計情報を計算
        const upcoming =
          gamesData?.filter((g) => g.status === "scheduled").length || 0;
        const completed =
          gamesData?.filter((g) => g.status === "completed").length || 0;

        setStats({
          totalTeams: teamsData?.length || 0,
          totalGames: gamesData?.length || 0,
          upcomingGames: upcoming,
          completedGames: completed,
        });
      }
    } catch (error) {
      console.error("ダッシュボードデータ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUpcomingGames = () => {
    return games.filter((game) => game.status === "scheduled").slice(0, 5);
  };

  const getRecentGames = () => {
    return games.filter((game) => game.status === "completed").slice(0, 5);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { color: "bg-blue-100 text-blue-800", text: "予定" },
      in_progress: { color: "bg-yellow-100 text-yellow-800", text: "進行中" },
      completed: { color: "bg-green-100 text-green-800", text: "終了" },
      cancelled: { color: "bg-red-100 text-red-800", text: "中止" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-100 text-gray-800",
      text: status,
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ダッシュボード
              </h1>
              <p className="mt-1 text-gray-600">ようこそ、{user?.email}さん</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/teams/create"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                チーム作成
              </Link>
              <Link
                href="/games/create"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                試合作成
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-blue-600"
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
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">所属チーム</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalTeams}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-green-600"
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
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">全試合数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalGames}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-yellow-600"
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
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">予定試合</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.upcomingGames}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">完了試合</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completedGames}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* マイチーム */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  マイチーム
                </h2>
                <Link
                  href="/teams"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  すべて見る
                </Link>
              </div>
            </div>
            <div className="p-6">
              {teams.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">チームがありません</p>
                  <Link
                    href="/teams/create"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    チームを作成
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {teams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {team.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {team.description || "説明なし"}
                          </p>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 今後の試合 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  今後の試合
                </h2>
                <Link
                  href="/games"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  すべて見る
                </Link>
              </div>
            </div>
            <div className="p-6">
              {getUpcomingGames().length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    予定された試合がありません
                  </p>
                  <Link
                    href="/games/create"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    試合を作成
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {getUpcomingGames().map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.id}`}
                      className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {game.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span>
                              {new Date(game.game_date).toLocaleDateString(
                                "ja-JP"
                              )}
                            </span>
                            {game.game_time && <span>{game.game_time}</span>}
                            <span>vs {game.opponent_name}</span>
                          </div>
                        </div>
                        {getStatusBadge(game.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 最近の試合結果 */}
        {getRecentGames().length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                最近の試合結果
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {getRecentGames().map((game) => (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {game.name}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>
                            {new Date(game.game_date).toLocaleDateString(
                              "ja-JP"
                            )}
                          </span>
                          <span className="font-semibold">
                            {game.home_score} - {game.opponent_score}
                          </span>
                          <span>vs {game.opponent_name}</span>
                        </div>
                      </div>
                      {getStatusBadge(game.status)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
