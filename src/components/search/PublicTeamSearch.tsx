"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function PublicTeamSearch() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setError(null);

      // デバッグ: Supabaseクライアントの確認
      console.log("Supabaseクライアント:", supabase);

      const {
        data,
        error: fetchError,
        status,
        statusText,
      } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // デバッグ情報
      console.log("Response status:", status);
      console.log("Response statusText:", statusText);
      console.log("Response data:", data);
      console.log("Response error:", fetchError);

      if (fetchError) {
        console.error("チーム取得エラー詳細:", {
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code,
        });
        setError(
          `エラー: ${fetchError.message || "チームの取得に失敗しました"}`
        );
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

      const { data, error: searchError } = await query;

      if (searchError) {
        console.error("検索エラー:", searchError);
        setError(`検索エラー: ${searchError.message}`);
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
          <div className="flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="チーム名で検索..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              検索
            </button>
          </div>
        </div>

        {/* デバッグ情報（開発環境のみ） */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              デバッグ: {teams.length}件のチームが見つかりました
            </p>
            <p className="text-sm text-yellow-800">
              Supabase URL:{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...
            </p>
          </div>
        )}

        {/* チーム一覧 */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">公開されているチームがありません</p>
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
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {team.description || "チームの説明はありません"}
                </p>
                <div className="flex items-center justify-between">
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
