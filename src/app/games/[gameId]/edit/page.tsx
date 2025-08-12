"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (user && gameId) {
      fetchGameAndTeams();
    }
  }, [user, gameId]);

  const fetchGameAndTeams = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error("試合取得エラー:", gameError);
        router.push("/games");
        return;
      }

      // 編集権限の確認
      const isOwner = gameData.created_by === user?.id;
      let isTeamOwner = false;

      if (gameData.home_team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("owner_id")
          .eq("id", gameData.home_team_id)
          .single();

        isTeamOwner = teamData?.owner_id === user?.id;
      }

      if (!isOwner && !isTeamOwner) {
        alert("この試合を編集する権限がありません");
        router.push(`/games/${gameId}`);
        return;
      }

      setCanEdit(true);
      setGame(gameData);

      // フォームの初期値を設定
      setGameName(gameData.name);
      setGameDate(gameData.game_date);
      setGameTime(gameData.game_time || "");
      setLocation(gameData.location || "");
      setDescription(gameData.description || "");
      setSelectedTeamId(gameData.home_team_id || "");
      setOpponentName(gameData.opponent_name);
      setStatus(gameData.status);
      setRecordType(gameData.record_type || "team");
      setIsPublic(gameData.is_public !== false);

      // ユーザーのチーム一覧を取得
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (!teamsError && teamsData) {
        setTeams(teamsData);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
      router.push("/games");
    } finally {
      setLoading(false);
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

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("games")
        .update({
          name: gameName.trim(),
          game_date: gameDate,
          game_time: gameTime || null,
          location: location.trim() || null,
          description: description.trim() || null,
          home_team_id: selectedTeamId || null,
          opponent_name: opponentName.trim() || "未定",
          status: status,
          record_type: recordType,
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (updateError) {
        console.error("試合更新エラー:", updateError);
        setError("試合の更新に失敗しました");
        return;
      }

      // 更新成功後、試合詳細ページへリダイレクト
      router.push(`/games/${gameId}`);
    } catch (error) {
      console.error("更新エラー:", error);
      setError("試合の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("本当にこの試合を削除しますか？この操作は取り消せません。")) {
      return;
    }

    try {
      const { error } = await supabase.from("games").delete().eq("id", gameId);

      if (error) {
        console.error("削除エラー:", error);
        alert("試合の削除に失敗しました");
        return;
      }

      router.push("/games");
    } catch (error) {
      console.error("削除エラー:", error);
      alert("試合の削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!game || !canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">試合が見つかりません</p>
          <Link href="/games" className="text-blue-600 hover:text-blue-700">
            試合一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link
            href={`/games/${gameId}`}
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
            試合詳細に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            試合情報を編集
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
            {recordType === "team" && teams.length > 0 && (
              <div className="mb-6">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">チームを選択（任意）</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
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

            {/* ステータス */}
            <div className="mb-6">
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                ステータス
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="scheduled">予定</option>
                <option value="in_progress">進行中</option>
                <option value="completed">終了</option>
                <option value="cancelled">中止</option>
              </select>
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
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                削除
              </button>
              <div className="flex space-x-4">
                <Link
                  href={`/games/${gameId}`}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </Link>
                <button
                  type="submit"
                  disabled={saving || !gameName.trim() || !gameDate}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "保存中..." : "変更を保存"}
                </button>
              </div>
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
