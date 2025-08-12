"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";

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
  record_type: string;
  created_at: string;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (user) {
      fetchGames();
    }
  }, [user]);

  const fetchGames = async () => {
    try {
      // まず自分が作成した試合を取得
      const { data: createdGames, error: createdError } = await supabase
        .from("games")
        .select("*")
        .eq("created_by", user?.id);

      if (createdError) {
        console.error("作成試合取得エラー:", createdError);
      }

      // 次に自分がオーナーのチームの試合を取得
      const { data: myTeams, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", user?.id);

      if (teamsError) {
        console.error("チーム取得エラー:", teamsError);
      }

      let teamGames: any[] = [];
      if (myTeams && myTeams.length > 0) {
        const teamIds = myTeams.map((team) => team.id);
        const { data: teamGamesData, error: teamGamesError } = await supabase
          .from("games")
          .select("*")
          .in("home_team_id", teamIds);

        if (teamGamesError) {
          console.error("チーム試合取得エラー:", teamGamesError);
        } else {
          teamGames = teamGamesData || [];
        }
      }

      // 重複を除いて結合
      const allGames = [...(createdGames || []), ...teamGames];
      const uniqueGames = Array.from(
        new Map(allGames.map((game) => [game.id, game])).values()
      );

      // 日付でソート
      uniqueGames.sort(
        (a, b) =>
          new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
      );

      console.log("取得した試合一覧:", uniqueGames); // デバッグ用
      setGames(uniqueGames);
    } catch (error) {
      console.error("試合取得エラー:", error);
      setGames([]);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">試合一覧</h1>
          <Link
            href="/games/create"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            新しい試合を作成
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">試合がまだありません</p>
            <Link
              href="/games/create"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              最初の試合を作成
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    試合名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日付
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    対戦相手
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    スコア
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    種別
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {games.map((game) => (
                  <tr key={game.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/games/${game.id}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {game.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(game.game_date).toLocaleDateString("ja-JP")}
                      {game.game_time && ` ${game.game_time}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {game.opponent_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {game.status === "completed" ||
                      game.status === "in_progress"
                        ? `${game.home_score} - ${game.opponent_score}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(game.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {game.record_type === "personal" ? "個人" : "チーム"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
