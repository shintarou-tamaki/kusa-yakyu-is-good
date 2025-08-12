"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
}

export default function CreateGamePage() {
  const searchParams = useSearchParams();
  const teamIdFromUrl = searchParams.get("teamId");

  const [gameName, setGameName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [gameTime, setGameTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(teamIdFromUrl || "");
  const [opponentName, setOpponentName] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchUserTeams();
  }, [user]);

  // URLパラメータからteamIdが来た場合、自動選択
  useEffect(() => {
    if (teamIdFromUrl) {
      setSelectedTeamId(teamIdFromUrl);
    }
  }, [teamIdFromUrl]);

  const fetchUserTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("チーム取得エラー:", error);
        return;
      }

      setTeams(data || []);
    } catch (error) {
      console.error("チーム取得エラー:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gameName.trim()) {
      setError("試合名を入力してください");
      return;
    }

    if (!gameDate) {
      setError("試合日を選択してください");
      return;
    }

    if (!selectedTeamId) {
      setError("チームを選択してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // gamesテーブルに試合を作成
      const { data, error: createError } = await supabase
        .from("games")
        .insert([
          {
            name: gameName.trim(),
            game_date: gameDate,
            game_time: gameTime || null,
            location: location.trim() || null,
            description: description.trim() || null,
            home_team_id: selectedTeamId,
            opponent_name: opponentName.trim() || "未定",
            created_by: user?.id,
            status: "scheduled", // scheduled, in_progress, completed, cancelled
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("試合作成エラー:", createError);

        if (createError.code === "42P01") {
          setError(
            "gamesテーブルが存在しません。データベースの設定が必要です。"
          );
          // テーブル作成のSQLを表示
          console.log(`
            CREATE TABLE games (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              game_date DATE NOT NULL,
              game_time TIME,
              location TEXT,
              description TEXT,
              home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
              opponent_name VARCHAR(100),
              created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
              status VARCHAR(20) DEFAULT 'scheduled',
              home_score INTEGER DEFAULT 0,
              opponent_score INTEGER DEFAULT 0,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
        } else {
          setError(`エラー: ${createError.message}`);
        }
        return;
      }

      // 作成成功後、試合詳細ページへリダイレクト
      router.push(`/games/${data.id}`);
    } catch (error) {
      console.error("試合作成エラー:", error);
      setError("試合の作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link
            href={teamIdFromUrl ? `/teams/${teamIdFromUrl}` : "/dashboard"}
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
            {teamIdFromUrl ? "チーム詳細に戻る" : "ダッシュボードに戻る"}
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            新しい試合を作成
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* チーム選択 */}
            <div className="mb-6">
              <label
                htmlFor="team"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                チーム <span className="text-red-500">*</span>
              </label>
              {teams.length > 0 ? (
                <select
                  id="team"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">チームを選択してください</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    先にチームを作成してください
                  </p>
                  <Link
                    href="/teams/create"
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    チームを作成する
                  </Link>
                </div>
              )}
            </div>

            {/* 試合名 */}
            <div className="mb-6">
              <label
                htmlFor="gameName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                試合名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="gameName"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 練習試合 vs チーム名"
                maxLength={100}
                required
              />
            </div>

            {/* 対戦相手 */}
            <div className="mb-6">
              <label
                htmlFor="opponent"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                対戦相手
              </label>
              <input
                type="text"
                id="opponent"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 草野球チーム太陽"
                maxLength={100}
              />
            </div>

            {/* 日付と時間 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  htmlFor="gameDate"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  試合日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="gameDate"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="gameTime"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  開始時間
                </label>
                <input
                  type="time"
                  id="gameTime"
                  value={gameTime}
                  onChange={(e) => setGameTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 場所 */}
            <div className="mb-6">
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                場所
              </label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: ○○野球場"
              />
            </div>

            {/* 説明 */}
            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                メモ・備考
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="集合時間や持ち物など"
                rows={3}
                maxLength={500}
              />
            </div>

            {/* ボタン */}
            <div className="flex justify-end space-x-4">
              <Link
                href={teamIdFromUrl ? `/teams/${teamIdFromUrl}` : "/dashboard"}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={
                  loading || !gameName.trim() || !gameDate || !selectedTeamId
                }
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "作成中..." : "試合を作成"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
