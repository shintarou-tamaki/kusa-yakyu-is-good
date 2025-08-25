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
  const [opponentName, setOpponentName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [attendanceCheckEnabled, setAttendanceCheckEnabled] = useState(false); // 出欠確認機能の追加
  const [category, setCategory] = useState<"official" | "practice" | "scrimmage">("practice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 記録タイプの管理
  const [recordType, setRecordType] = useState<"team" | "personal">("team");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [isMyTeamBatFirst, setIsMyTeamBatFirst] = useState<boolean | null>(
    null
  );

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (user) {
      fetchUserTeams();
    }
  }, [user]);

  useEffect(() => {
    // URLパラメータからチームIDが渡された場合、そのチームを選択
    if (teamIdFromUrl && teams.length > 0) {
      const team = teams.find((t) => t.id === teamIdFromUrl);
      if (team) {
        setSelectedTeamId(teamIdFromUrl);
        setRecordType("team");
      }
    }
  }, [teamIdFromUrl, teams]);

  const fetchUserTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select(
          `
          team_id,
          role,
          teams (
            id,
            name
          )
        `
        )
        .eq("user_id", user!.id);

      if (error) throw error;

      if (data) {
        const userTeams = data.map((item: any) => ({
          id: item.teams.id,
          name: item.teams.name,
          role: item.role,
        }));
        setTeams(userTeams);

        // デフォルトでチームを選択（1つしかない場合）
        if (userTeams.length === 1) {
          setSelectedTeamId(userTeams[0].id);
        }
      }
    } catch (error) {
      console.error("チーム取得エラー:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // チーム記録かつチーム選択時は先攻/後攻が必須
    if (recordType === "team" && selectedTeamId && isMyTeamBatFirst === null) {
      setError("先攻・後攻を選択してください");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("games")
        .insert([
          {
            name: gameName,
            game_date: gameDate,
            game_time: gameTime || null,
            location: location || null,
            description: description || null,
            home_team_id:
              recordType === "team" && selectedTeamId ? selectedTeamId : null,
            opponent_name: opponentName || "未定",
            status: "scheduled",
            record_type:
              recordType === "team" && selectedTeamId ? "team" : "individual",
            is_public: isPublic,
            attendance_check_enabled: attendanceCheckEnabled, // 出欠確認設定を保存
            category: category,
            created_by: user!.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // チーム記録の場合、先攻/後攻情報を保存
        if (
          recordType === "team" &&
          selectedTeamId &&
          isMyTeamBatFirst !== null
        ) {
          const { error: scoreError } = await supabase
            .from("game_scores")
            .insert([
              {
                game_id: data.id,
                inning: 1,
                is_my_team_bat_first: isMyTeamBatFirst,
              },
            ]);

          if (scoreError) {
            console.error("先攻/後攻情報の保存エラー:", scoreError);
          }
        }

        // 出欠確認が有効な場合、チームメンバー全員の出欠レコードを作成
        if (attendanceCheckEnabled && selectedTeamId) {
          // チームメンバーを取得
          const { data: teamMembers, error: tmError } = await supabase
            .from("team_members")
            .select("id")
            .eq("team_id", selectedTeamId);

          if (tmError) {
            console.error("チームメンバー取得エラー:", tmError);
          } else if (teamMembers && teamMembers.length > 0) {
            // 各メンバーの出欠レコードを作成
            const attendanceRecords = teamMembers.map((member) => ({
              game_id: data.id,
              team_member_id: member.id,
              status: "pending",
            }));

            const { error: attendanceError } = await supabase
              .from("game_attendances")
              .insert(attendanceRecords);

            if (attendanceError) {
              console.error("出欠レコード作成エラー:", attendanceError);
            }
          }
        }

        router.push(`/games/${data.id}`);
      }
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

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold text-gray-900">新規試合作成</h1>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* 記録タイプ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                記録タイプ
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="team"
                    checked={recordType === "team"}
                    onChange={(e) =>
                      setRecordType(e.target.value as "team" | "personal")
                    }
                    className="mr-2"
                  />
                  <span>チーム記録</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="personal"
                    checked={recordType === "personal"}
                    onChange={(e) =>
                      setRecordType(e.target.value as "team" | "personal")
                    }
                    className="mr-2"
                  />
                  <span>個人記録</span>
                </label>
              </div>
            </div>

            {/* チーム選択（チーム記録の場合のみ） */}
            {recordType === "team" && (
              <div>
                <label
                  htmlFor="team"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  チーム
                </label>
                <select
                  id="team"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">チームを選択（任意）</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                      {team.role === "owner" && " (オーナー)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 先攻/後攻選択（チーム記録かつチーム選択時のみ） */}
            {recordType === "team" && selectedTeamId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  先攻・後攻 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMyTeamBatFirst(true)}
                    className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                      isMyTeamBatFirst === true
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    先攻（表の攻撃）
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMyTeamBatFirst(false)}
                    className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                      isMyTeamBatFirst === false
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    後攻（裏の攻撃）
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  草野球は7回制です。先攻チームは表、後攻チームは裏の攻撃となります。
                </p>
              </div>
            )}

            {/* 試合名 */}
            <div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例: 2024年春季大会 準決勝"
                required
              />
            </div>

            {/* 対戦相手 */}
            <div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例: 山田タイガース"
              />
            </div>

{/* 試合カテゴリー */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    試合カテゴリー *
  </label>
  <select
    value={category}
    onChange={(e) => setCategory(e.target.value as "official" | "practice" | "scrimmage")}
    required
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="official">公式戦</option>
    <option value="practice">練習試合</option>
    <option value="scrimmage">紅白戦</option>
  </select>
</div>

            {/* 日付 */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* 時間 */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 場所 */}
            <div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例: 市民球場"
              />
            </div>

            {/* 説明 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="試合に関するメモなど"
              />
            </div>

            {/* 出欠確認機能（チーム記録かつチーム選択時のみ表示） */}
            {recordType === "team" && selectedTeamId && (
              <div className="border-t pt-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attendanceCheckEnabled}
                    onChange={(e) =>
                      setAttendanceCheckEnabled(e.target.checked)
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      出欠確認を有効にする
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      チームメンバーに出欠確認を求めることができます
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* 公開設定 */}
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  この試合を公開する
                </span>
              </label>
            </div>

            {/* 送信ボタン */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
