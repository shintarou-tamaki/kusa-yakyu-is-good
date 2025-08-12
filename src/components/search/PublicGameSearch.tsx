"use client";

import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

interface Game {
  id: string;
  name: string; // titleではなくname
  game_date: string; // dateではなくgame_date
  game_time: string | null; // start_timeではなくgame_time
  location: string | null; // venueではなくlocation
  opponent_name: string;
  status: string;
  home_score: number;
  opponent_score: number;
  record_type: string;
  is_public: boolean;
  created_at: string;
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
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchGames();
  }, [filters]);

  const fetchGames = async () => {
    try {
      setError(null);

      let query = supabase
        .from("games")
        .select("*")
        .eq("is_public", true) // 公開試合のみ
        .order("game_date", { ascending: false });

      // フィルター適用
      if (filters.keyword) {
        query = query.or(
          `name.ilike.%${filters.keyword}%,location.ilike.%${filters.keyword}%,opponent_name.ilike.%${filters.keyword}%`
        );
      }

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte("game_date", filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte("game_date", filters.dateTo);
      }

      const { data, error: fetchError } = await query.limit(50);

      if (fetchError) {
        console.error("試合検索エラー詳細:", fetchError);
        setError(`エラー: ${fetchError.message}`);
        setGames([]);
      } else {
        console.log("取得した試合数:", data?.length);
        setGames(data || []);
      }
    } catch (error) {
      console.error("試合検索エラー:", error);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">試合検索</h1>
          <p className="text-gray-600">
            公開されている試合を検索・閲覧できます
          </p>
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
              return (
                <div
                  key={game.id}
                  className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-medium text-gray-900 truncate flex-1">
                      {game.name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ml-2 ${statusBadge.class}`}
                    >
                      {statusBadge.label}
                    </span>
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

                    {game.record_type && (
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
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        <span>
                          {game.record_type === "personal"
                            ? "個人記録"
                            : "チーム記録"}
                        </span>
                      </div>
                    )}
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
