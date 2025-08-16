"use client";

import React, { useState, useEffect } from "react";
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
  is_public: boolean;
  created_at: string;
  home_team_id: string | null;
}

interface SearchFilters {
  keyword: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export default function PublicGameSearch() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const { user } = useAuth();
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchUserTeams();
  }, [user]);

  useEffect(() => {
    fetchGames();
  }, [filters, userTeamIds]);

  const fetchUserTeams = async () => {
    if (!user) {
      setUserTeamIds([]);
      return;
    }

    try {
      const teamIds: string[] = [];

      // オーナーとして所有するチーム
      const { data: ownedTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", user.id);

      if (ownedTeams) {
        ownedTeams.forEach(team => teamIds.push(team.id));
      }

      // メンバーとして所属するチーム
      const { data: memberTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);

      if (memberTeams) {
        memberTeams.forEach(member => {
          if (!teamIds.includes(member.team_id)) {
            teamIds.push(member.team_id);
          }
        });
      }

      setUserTeamIds(teamIds);
    } catch (error) {
      console.error("チーム情報取得エラー:", error);
    }
  };

  const fetchGames = async () => {
    try {
      setError(null);
      setLoading(true);

      let allGames: Game[] = [];

      // 1. 完了した公開試合を取得（全ユーザー向け）
      let completedQuery = supabase
        .from("games")
        .select("*")
        .eq("is_public", true)
        .eq("status", "completed")
        .order("game_date", { ascending: false });

      // フィルター適用
      if (filters.keyword) {
        completedQuery = completedQuery.or(
          `name.ilike.%${filters.keyword}%,location.ilike.%${filters.keyword}%,opponent_name.ilike.%${filters.keyword}%`
        );
      }

      if (filters.dateFrom) {
        completedQuery = completedQuery.gte("game_date", filters.dateFrom);
      }

      if (filters.dateTo) {
        completedQuery = completedQuery.lte("game_date", filters.dateTo);
      }

      const { data: completedGames, error: completedError } = await completedQuery.limit(50);

      if (completedError) {
        console.error("完了試合取得エラー:", completedError);
        setError(`エラー: ${completedError.message}`);
      } else if (completedGames) {
        allGames = [...completedGames];
      }

      // 2. ユーザーが所属するチームの全試合を取得（ログインユーザーのみ）
      if (user && userTeamIds.length > 0) {
        let teamGamesQuery = supabase
          .from("games")
          .select("*")
          .in("home_team_id", userTeamIds)
          .eq("is_public", true)
          .order("game_date", { ascending: false });

        // フィルター適用
        if (filters.keyword) {
          teamGamesQuery = teamGamesQuery.or(
            `name.ilike.%${filters.keyword}%,location.ilike.%${filters.keyword}%,opponent_name.ilike.%${filters.keyword}%`
          );
        }

        if (filters.status) {
          teamGamesQuery = teamGamesQuery.eq("status", filters.status);
        }

        if (filters.dateFrom) {
          teamGamesQuery = teamGamesQuery.gte("game_date", filters.dateFrom);
        }

        if (filters.dateTo) {
          teamGamesQuery = teamGamesQuery.lte("game_date", filters.dateTo);
        }

        const { data: teamGames, error: teamError } = await teamGamesQuery.limit(50);

        if (teamError) {
          console.error("チーム試合取得エラー:", teamError);
        } else if (teamGames) {
          // 重複を除いて追加
          const existingIds = new Set(allGames.map(g => g.id));
          teamGames.forEach(game => {
            if (!existingIds.has(game.id)) {
              allGames.push(game);
            }
          });
        }
      }

      // 3. statusフィルターの適用（ログインしていない場合）
      if (!user && filters.status && filters.status !== "completed") {
        allGames = [];
      } else if (filters.status) {
        allGames = allGames.filter(game => game.status === filters.status);
      }

      // 日付でソート
      allGames.sort((a, b) => 
        new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
      );

      console.log("取得した試合数:", allGames.length);
      setGames(allGames);
    } catch (error) {
      console.error("予期しないエラー:", error);
      setError("試合の検索中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      keyword: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: "bg-blue-100 text-blue-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    const labels = {
      scheduled: "予定",
      in_progress: "進行中",
      completed: "終了",
      cancelled: "中止",
    };
    return {
      class:
        badges[status as keyof typeof badges] || "bg-gray-100 text-gray-800",
      label: labels[status as keyof typeof labels] || status,
    };
  };

  // チーム関係者かどうかを判定
  const isTeamMember = (teamId: string | null) => {
    if (!teamId || !user) return false;
    return userTeamIds.includes(teamId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">試合検索</h1>
          <p className="text-gray-600">
            {user && userTeamIds.length > 0
              ? "公開試合と所属チームの試合を検索・閲覧できます"
              : "公開されている完了試合を検索・閲覧できます"}
          </p>
        </div>

        {/* 注意表示 */}
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
              <p className="font-semibold">表示される試合について</p>
              {user && userTeamIds.length > 0 ? (
                <p>
                  所属チームの全試合と、その他の完了した公開試合が表示されます。
                </p>
              ) : (
                <p>
                  完了した公開試合のみが表示されます。予定試合や進行中の試合を見るには、チームに参加してください。
                </p>
              )}
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* 検索フィルター */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="keyword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                キーワード
              </label>
              <input
                type="text"
                id="keyword"
                value={filters.keyword}
                onChange={(e) => handleFilterChange("keyword", e.target.value)}
                placeholder="試合名、場所、対戦相手で検索"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                ステータス
              </label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!user || userTeamIds.length === 0}
              >
                <option value="">すべて</option>
                {user && userTeamIds.length > 0 && (
                  <>
                    <option value="scheduled">予定</option>
                    <option value="in_progress">進行中</option>
                  </>
                )}
                <option value="completed">終了</option>
                <option value="cancelled">中止</option>
              </select>
              {(!user || userTeamIds.length === 0) && (
                <p className="text-xs text-gray-500 mt-1">
                  ※完了試合のみ表示されます
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="dateFrom"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                開始日
              </label>
              <input
                type="date"
                id="dateFrom"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="dateTo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                終了日
              </label>
              <input
                type="date"
                id="dateTo"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              フィルターをクリア
            </button>
            <div className="text-sm text-gray-500">
              {games.length} 件の試合が見つかりました
            </div>
          </div>
        </div>

        {/* 試合一覧 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">検索中...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mt-2">
              試合が見つかりませんでした
            </h3>
            <p className="text-gray-500 mt-1">
              検索条件を変更してもう一度お試しください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => {
              const statusBadge = getStatusBadge(game.status);
              const isMember = isTeamMember(game.home_team_id);
              
              return (
                <div
                  key={game.id}
                  className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-medium text-gray-900 truncate flex-1">
                      {game.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.class}`}
                      >
                        {statusBadge.label}
                      </span>
                      {isMember && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          所属
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center space-x-1">
                      <svg
                        className="w-4 h-4"
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
                      <span>
                        {new Date(game.game_date).toLocaleDateString("ja-JP")}
                      </span>
                      {game.game_time && (
                        <span className="ml-1">{game.game_time}</span>
                      )}
                    </div>

                    {game.location && (
                      <div className="flex items-center space-x-1">
                        <svg
                          className="w-4 h-4"
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
                        <span className="truncate">{game.location}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-1">
                      <svg
                        className="w-4 h-4"
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
                      <span>vs {game.opponent_name}</span>
                    </div>
                  </div>

                  {/* スコア表示（完了した試合のみ） */}
                  {game.status === "completed" && (
                    <div className="border-t pt-3 mb-3">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span className="text-blue-600">ホーム</span>
                        <span>
                          {game.home_score} - {game.opponent_score}
                        </span>
                        <span className="text-red-600">
                          {game.opponent_name}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 詳細ボタン */}
                  <div className="mt-4">
                    <Link
                      href={`/games/${game.id}`}
                      className="w-full bg-blue-600 text-white text-center py-2 px-4 rounded-md hover:bg-blue-700 transition-colors block"
                    >
                      詳細を見る
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}