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
  category: 'official' | 'practice' | 'scrimmage' | null;
}

interface SearchFilters {
  keyword: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  category: string;
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
    category: "",
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
        teamIds.push(...ownedTeams.map((t) => t.id));
      }

      // メンバーとして所属するチーム
      const { data: memberTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);

      if (memberTeams) {
        teamIds.push(...memberTeams.map((t) => t.team_id));
      }

      setUserTeamIds([...new Set(teamIds)]);
    } catch (error) {
      console.error("チーム情報の取得に失敗しました:", error);
    }
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from("games").select("*");

      // 公開試合、または自分が関連するチームの試合、または自分が作成した試合のみ表示
      if (user) {
        // userTeamIdsが空の場合と空でない場合で条件を分ける
        if (userTeamIds.length > 0) {
          query = query.or(
            `is_public.eq.true,home_team_id.in.(${`{${userTeamIds.join(
              ","
            )}}`}),created_by.eq.${user.id}`
          );
        } else {
          // チームに所属していない場合は、公開試合と自分が作成した試合のみ
          query = query.or(`is_public.eq.true,created_by.eq.${user.id}`);
        }
      } else {
        // 未ログインユーザーは公開試合のみ表示
        query = query.eq("is_public", true);
      }

      // ステータスフィルタ
      if (filters.status) {
        query = query.eq("status", filters.status);
      } else if (!user || userTeamIds.length === 0) {
        // 未ログインまたはチーム未所属の場合は完了試合のみ表示
        query = query.eq("status", "completed");
      }

      // カテゴリーフィルタ
      if (filters.category) {
        query = query.eq("category", filters.category);
      }

      // キーワード検索
      if (filters.keyword) {
        query = query.or(
          `name.ilike.%${filters.keyword}%,opponent_name.ilike.%${filters.keyword}%,location.ilike.%${filters.keyword}%`
        );
      }

      // 日付範囲フィルタ
      if (filters.dateFrom) {
        query = query.gte("game_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("game_date", filters.dateTo);
      }

      // 日付の降順でソート
      query = query.order("game_date", { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // フィルタリング: 「予定」の試合は所属チームまたは作成者のみに表示
      let filteredGames = data || [];
      
      if (!user) {
        // 未ログインユーザーは終了試合のみ表示
        filteredGames = filteredGames.filter((game) => game.status === 'completed');
      } else {
        // ログインユーザーの場合
        filteredGames = filteredGames.filter((game) => {
          // 終了・中止試合は全て表示
          if (game.status === 'completed' || game.status === 'cancelled') {
            return true;
          }
          
          // 予定・進行中の試合は、以下の条件のいずれかを満たす場合のみ表示
          if (game.status === 'scheduled' || game.status === 'in_progress') {
            // 自分が作成した試合
            if (game.created_by === user.id) {
              return true;
            }
            
            // 所属チームの試合
            if (game.home_team_id && userTeamIds.includes(game.home_team_id)) {
              return true;
            }
            
            // それ以外は表示しない
            return false;
          }
          
          // その他のステータスは表示
          return true;
        });
      }

      setGames(filteredGames);
    } catch (error: any) {
      console.error("試合情報の取得に失敗しました:", error?.message || error);
      setError("試合情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters({
      keyword: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      category: "",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return {
          label: "予定",
          class: "bg-gray-100 text-gray-800",
        };
      case "in_progress":
        return {
          label: "進行中",
          class: "bg-yellow-100 text-yellow-800",
        };
      case "completed":
        return {
          label: "終了",
          class: "bg-green-100 text-green-800",
        };
      case "cancelled":
        return {
          label: "中止",
          class: "bg-red-100 text-red-800",
        };
      default:
        return {
          label: status,
          class: "bg-gray-100 text-gray-800",
        };
    }
  };
  const getCategoryBadge = (category: string | null) => {
    switch (category) {
      case "official":
        return {
          label: "公式戦",
          class: "bg-red-100 text-red-800",
        };
      case "practice":
        return {
          label: "練習試合",
          class: "bg-blue-100 text-blue-800",
        };
      case "scrimmage":
        return {
          label: "紅白戦",
          class: "bg-green-100 text-green-800",
        };
      default:
        return null;
    }
  };

  const isTeamMember = (teamId: string | null) => {
    if (!teamId) return false;
    return userTeamIds.includes(teamId);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">試合を探す</h1>

        {/* 検索フィルター */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                placeholder="試合名、対戦相手、場所"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">すべて</option>
                <option value="scheduled">予定</option>
                <option value="in_progress">進行中</option>
                <option value="completed">終了</option>
                <option value="cancelled">中止</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                カテゴリー
              </label>
              <select
                id="category"
                value={filters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">すべて</option>
                <option value="official">公式戦</option>
                <option value="practice">練習試合</option>
                <option value="scrimmage">紅白戦</option>
              </select>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              フィルターをリセット
            </button>
          </div>
        </div>

        {/* 検索結果 */}
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : loading ? (
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
                      {game.category && getCategoryBadge(game.category) && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            getCategoryBadge(game.category)!.class
                          }`}
                        >
                          {getCategoryBadge(game.category)!.label}
                        </span>
                      )}
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
                        className="w-4 h-4 text-gray-400"
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
                      {game.game_time && <span>• {game.game_time}</span>}
                    </div>

                    {game.location && (
                      <div className="flex items-center space-x-1">
                        <svg
                          className="w-4 h-4 text-gray-400"
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
                        <span className="truncate">{game.location}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-1">
                      <svg
                        className="w-4 h-4 text-gray-400"
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
                      <span>vs {game.opponent_name}</span>
                    </div>
                  </div>

                  {/* スコア表示 */}
                  {(game.status === "completed" ||
                    game.status === "in_progress") && (
                    <div className="flex justify-center items-center space-x-4 py-3 mb-4 bg-gray-50 rounded-md">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {game.home_score}
                        </div>
                        <div className="text-xs text-gray-500">自チーム</div>
                      </div>
                      <div className="text-gray-400">-</div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {game.opponent_score}
                        </div>
                        <div className="text-xs text-gray-500">
                          {game.opponent_name}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span
                        className={
                          game.record_type === "team"
                            ? "bg-blue-100 text-blue-700 px-2 py-1 rounded"
                            : "bg-green-100 text-green-700 px-2 py-1 rounded"
                        }
                      >
                        {game.record_type === "team"
                          ? "チーム記録"
                          : "個人記録"}
                      </span>
                      {!game.is_public && (
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          🔒 非公開
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/games/${game.id}?from=search`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      詳細を見る →
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
