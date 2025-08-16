"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { prefectures } from "@/lib/japanData";

interface Team {
  id: string;
  name: string;
  description: string;
  prefecture: string | null;
  city: string | null;
  created_at: string;
}

export default function PublicTeamSearch() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setError(null);

      let query = supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // 都道府県フィルター
      if (selectedPrefecture) {
        query = query.eq("prefecture", selectedPrefecture);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error("チーム取得エラー:", fetchError);
        setError("チームの取得に失敗しました");
        setTeams([]);
      } else {
        setTeams(data || []);
      }
    } catch (error) {
      console.error("予期しないエラー:", error);
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      if (selectedPrefecture) {
        query = query.eq("prefecture", selectedPrefecture);
      }

      const { data, error: searchError } = await query;

      if (searchError) {
        console.error("検索エラー:", searchError);
        setError("検索中にエラーが発生しました");
        setTeams([]);
      } else {
        setTeams(data || []);
      }
    } catch (error) {
      console.error("検索エラー:", error);
      setError("検索中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedPrefecture("");
    setSearchTerm("");
    fetchTeams();
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">チーム検索</h1>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* 検索バー */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="チーム名で検索..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={selectedPrefecture}
                onChange={(e) => setSelectedPrefecture(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全都道府県</option>
                {prefectures.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                検索
              </button>
            </div>
            {(selectedPrefecture || searchTerm) && (
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {selectedPrefecture && (
                    <span className="mr-2">
                      都道府県: <span className="font-medium">{selectedPrefecture}</span>
                    </span>
                  )}
                  {searchTerm && (
                    <span>
                      キーワード: <span className="font-medium">{searchTerm}</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  フィルターをクリア
                </button>
              </div>
            )}
          </div>
        </div>

        {/* チーム一覧 */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">
              {searchTerm || selectedPrefecture
                ? "検索条件に一致するチームが見つかりませんでした"
                : "公開されているチームがありません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {team.name}
                </h3>
                <p className="text-gray-600 mb-2 line-clamp-2">
                  {team.description || "チームの説明はありません"}
                </p>
                {(team.prefecture || team.city) && (
                  <div className="flex items-center text-sm text-gray-500 mb-2">
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>
                      {team.prefecture}{team.city && ` ${team.city}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-500">
                    {new Date(team.created_at).toLocaleDateString("ja-JP")}
                  </span>
                  <Link
                    href={`/teams/${team.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    詳細を見る →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}