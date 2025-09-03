"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Game {
  id: string;
  name: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  description: string | null;
  home_team_id: string | null;
  opponent_name: string;
  status: string;
  home_score: number;
  opponent_score: number;
  record_type: string;
  is_public: boolean;
  attendance_check_enabled: boolean;
  category?: "official" | "practice" | "scrimmage";
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
}

interface PageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function EditGamePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameName, setGameName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [gameTime, setGameTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [recordType, setRecordType] = useState("team");
  const [isPublic, setIsPublic] = useState(true);
  const [attendanceCheckEnabled, setAttendanceCheckEnabled] = useState(false); // 出欠確認機能の追加
  const [category, setCategory] = useState<
    "official" | "practice" | "scrimmage"
  >("practice");
  const [isMyTeamBatFirst, setIsMyTeamBatFirst] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // クエリパラメータを継承するためのヘルパー関数
  const getGameDetailUrl = () => {
    const params = searchParams.toString();
    return params ? `/games/${gameId}?${params}` : `/games/${gameId}`;
  };

  useEffect(() => {
    // 認証状態の読み込み中は何もしない
    if (authLoading) return;

    // 未認証の場合はログインページへ
    if (!user) {
      router.push("/login");
      return;
    }

    // 認証済みの場合のみデータ取得
    fetchGameAndTeams();
  }, [gameId, user, authLoading]);

  const fetchGameAndTeams = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;

      if (gameData) {
        setGame(gameData);
        setGameName(gameData.name);
        setGameDate(gameData.game_date);
        setGameTime(gameData.game_time || "");
        setLocation(gameData.location || "");
        setDescription(gameData.description || "");
        setSelectedTeamId(gameData.home_team_id || "");
        setOpponentName(gameData.opponent_name);
        setStatus(gameData.status);
        setRecordType(gameData.record_type);
        setIsPublic(gameData.is_public);
        setAttendanceCheckEnabled(gameData.attendance_check_enabled || false); // 出欠確認設定を読み込み
        setCategory(gameData.category || "practice");

        // 先攻/後攻の設定を取得
        const { data: scoreData } = await supabase
          .from("game_scores")
          .select("is_my_team_bat_first")
          .eq("game_id", gameId)
          .limit(1)
          .single();

        if (scoreData) {
          setIsMyTeamBatFirst(scoreData.is_my_team_bat_first);
        }

        // 編集権限の確認
        if (user) {
          // 作成者か確認
          if (gameData.created_by === user.id) {
            setCanEdit(true);
          } else if (gameData.home_team_id) {
            // チームメンバーか確認
            const { data: member } = await supabase
              .from("team_members")
              .select("role")
              .eq("team_id", gameData.home_team_id)
              .eq("user_id", user.id)
              .single();

            if (member) {
              setCanEdit(true);
            }
          }
        }
      }

      // ユーザーが所属するチームを取得
      if (user) {
        const { data: teamMembers, error: tmError } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id);

        if (tmError) throw tmError;

        if (teamMembers && teamMembers.length > 0) {
          const teamIds = teamMembers.map((tm) => tm.team_id);
          const { data: teamsData, error: teamsError } = await supabase
            .from("teams")
            .select("id, name")
            .in("id", teamIds);

          if (teamsError) throw teamsError;
          if (teamsData) {
            setTeams(teamsData);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const updateData: any = {
        name: gameName,
        game_date: gameDate,
        game_time: gameTime || null,
        location: location || null,
        description: description || null,
        home_team_id: selectedTeamId || null,
        opponent_name: opponentName,
        status: status,
        record_type: selectedTeamId ? "team" : "individual",
        is_public: isPublic,
        attendance_check_enabled: attendanceCheckEnabled, // 出欠確認設定を更新
        category: category,
        updated_at: new Date().toISOString(),
      };

      // 先攻/後攻が設定されている場合、game_scoresも更新
      if (isMyTeamBatFirst !== null) {
        await supabase
          .from("game_scores")
          .update({ is_my_team_bat_first: isMyTeamBatFirst })
          .eq("game_id", gameId);
      }

      const { error } = await supabase
        .from("games")
        .update(updateData)
        .eq("id", gameId);

      if (error) throw error;

      // 出欠確認が新たに有効になった場合、出欠レコードを作成
      if (
        attendanceCheckEnabled &&
        !game?.attendance_check_enabled &&
        selectedTeamId
      ) {
        // チームメンバーを取得
        const { data: teamMembers, error: tmError } = await supabase
          .from("team_members")
          .select("id")
          .eq("team_id", selectedTeamId);

        if (tmError) {
          console.error("チームメンバー取得エラー:", tmError);
        } else if (teamMembers && teamMembers.length > 0) {
          // 既存の出欠レコードを確認
          const { data: existingAttendances } = await supabase
            .from("game_attendances")
            .select("team_member_id")
            .eq("game_id", gameId);

          const existingMemberIds =
            existingAttendances?.map((a) => a.team_member_id) || [];

          // 新規メンバーの出欠レコードのみ作成
          const newAttendanceRecords = teamMembers
            .filter((member) => !existingMemberIds.includes(member.id))
            .map((member) => ({
              game_id: gameId,
              team_member_id: member.id,
              status: "pending",
            }));

          if (newAttendanceRecords.length > 0) {
            const { error: attendanceError } = await supabase
              .from("game_attendances")
              .insert(newAttendanceRecords);

            if (attendanceError) {
              console.error("出欠レコード作成エラー:", attendanceError);
            }
          }
        }
      }

      router.push(`/games/${gameId}`);
    } catch (err: any) {
      setError(err.message || "試合の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-600">この試合を編集する権限がありません</p>
            <Link
              href={getGameDetailUrl()}
              className="mt-4 inline-block text-blue-600 hover:text-blue-700"
            >
              試合詳細に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">試合編集</h1>
            <Link
              href={getGameDetailUrl()}
              className="text-gray-600 hover:text-gray-900"
            >
              ← 戻る
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 試合名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                試合名 *
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 日付 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                試合日 *
              </label>
              <input
                type="date"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 時間 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                開始時間
              </label>
              <input
                type="time"
                value={gameTime}
                onChange={(e) => setGameTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 場所 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                場所
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* チーム選択 */}
            {teams.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  チーム
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">個人記録として作成</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 対戦相手 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                対戦相手
              </label>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 試合カテゴリー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                試合カテゴリー
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as "official" | "practice" | "scrimmage"
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="official">公式戦</option>
                <option value="practice">練習試合</option>
                <option value="scrimmage">紅白戦</option>
              </select>
            </div>

            {/* 先攻/後攻 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                先攻/後攻
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setIsMyTeamBatFirst(true)}
                  className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
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
                  className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    isMyTeamBatFirst === false
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  後攻（裏の攻撃）
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                設定は任意です。スコア入力時にも変更できます。
              </p>
            </div>

            {/* 試合カテゴリー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                試合カテゴリー
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as "official" | "practice" | "scrimmage"
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="official">公式戦</option>
                <option value="practice">練習試合</option>
                <option value="scrimmage">紅白戦</option>
              </select>
            </div>

            {/* ステータス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ステータス
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="scheduled">予定</option>
                <option value="in_progress">進行中</option>
                <option value="completed">完了</option>
                <option value="cancelled">中止</option>
              </select>
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
              />
            </div>

            {/* 出欠確認機能（チームが選択されている場合のみ表示） */}
            {selectedTeamId && (
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
                    {game?.attendance_check_enabled &&
                      !attendanceCheckEnabled && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️
                          出欠確認を無効にしても、既存の回答データは保持されます
                        </p>
                      )}
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
            <div className="flex justify-end space-x-4">
              <Link
                href={getGameDetailUrl()}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "変更を保存"}
              </button>
            </div>
          </form>

          {/* 試合情報 */}
          <div className="mt-8 pt-8 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">試合情報</h3>
            <dl className="text-sm space-y-1 text-gray-600">
              <div className="flex">
                <dt className="w-24">作成日:</dt>
                <dd>{new Date(game.created_at).toLocaleDateString("ja-JP")}</dd>
              </div>
              <div className="flex">
                <dt className="w-24">更新日:</dt>
                <dd>{new Date(game.updated_at).toLocaleDateString("ja-JP")}</dd>
              </div>
              {game.status === "completed" && (
                <div className="flex">
                  <dt className="w-24">スコア:</dt>
                  <dd>
                    {game.home_score} - {game.opponent_score}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
