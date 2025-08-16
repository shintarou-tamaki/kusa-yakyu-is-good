"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  role?: string;
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
  const [recordType, setRecordType] = useState("team");
  const [isPublic, setIsPublic] = useState(true);

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
      const allTeams: Team[] = [];
      const teamIds = new Set<string>();

      // 1. オーナーとして所有するチーム
      const { data: ownedTeams, error: ownedError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (ownedError) {
        console.error("所有チーム取得エラー:", ownedError);
      } else if (ownedTeams) {
        ownedTeams.forEach(team => {
          if (!teamIds.has(team.id)) {
            allTeams.push({
              ...team,
              role: 'owner'
            });
            teamIds.add(team.id);
          }
        });
      }

      // 2. メンバーとして所属するチーム
      const { data: memberData, error: memberError } = await supabase
        .from("team_members")
        .select(`
          team_id,
          role,
          teams:team_id (
            id,
            name
          )
        `)
        .eq("user_id", user?.id);

      if (memberError) {
        console.error("所属チーム取得エラー:", memberError);
      } else if (memberData) {
        memberData.forEach(member => {
          const team = member.teams as unknown as Team;
          if (team && !teamIds.has(team.id)) {
            allTeams.push({
              ...team,
              role: member.role
            });
            teamIds.add(team.id);
          }
        });
      }

      setTeams(allTeams);

      // URLパラメータのチームIDが所属チームに含まれているか確認
      if (teamIdFromUrl && !teamIds.has(teamIdFromUrl)) {
        setError("指定されたチームに所属していません");
        setSelectedTeamId("");
      }
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

    if (recordType === "team" && !selectedTeamId) {
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
            home_team_id: recordType === "team" ? selectedTeamId : null,
            opponent_name: opponentName.trim() || "未定",
            created_by: user?.id,
            status: "scheduled",
            record_type: recordType,
            is_public: isPublic,
            home_score: 0,
            opponent_score: 0,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("試合作成エラー:", createError);
        setError(`エラー: ${createError.message}`);
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
            {/* 記録タイプ */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                記録タイプ
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="team"
                    checked={recordType === "team"}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="mr-2"
                  />
                  <span>チーム記録</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="personal"
                    checked={recordType === "personal"}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="mr-2"
                  />
                  <span>個人記録</span>
                </label>
              </div>
            </div>

            {/* チーム選択（チーム記録の場合） */}
            {recordType === "team" && (
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
                        {team.role === 'owner' && ' (オーナー)'}
                        {team.role === 'member' && ' (メンバー)'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      所属するチームがありません
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
            )}

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

            {/* 公開設定 */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  この試合を公開する（他のユーザーも閲覧可能）
                </span>
              </label>
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
                  loading || 
                  !gameName.trim() || 
                  !gameDate || 
                  (recordType === "team" && !selectedTeamId)
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