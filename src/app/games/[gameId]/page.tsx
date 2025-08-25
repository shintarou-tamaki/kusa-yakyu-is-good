"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import OperationTasksDisplay from "@/components/game/OperationTasksDisplay";
import InlineScoreInput from "@/components/game/InlineScoreInput";
import ScoreBoxDisplay from "@/components/game/ScoreBoxDisplay";

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
  created_by: string;
  created_at: string;
  updated_at: string;
  category?: "official" | "practice" | "scrimmage";
}

interface Team {
  id: string;
  name: string;
}

interface GamePlayer {
  id: string;
  game_id: string;
  player_name: string;
  team_member_id: string | null;
  is_starter: boolean;
  batting_order: number | null;
  position: string | null;
  is_active: boolean;
}

interface GameAttendance {
  id: string;
  game_id: string;
  team_member_id: string | null;
  person_name: string | null;
  status: "pending" | "attending" | "absent";
  responded_at: string | null;
  team_member?: {
    // オプショナルに変更
    id: string;
    user_id: string;
    user_profiles: {
      display_name: string | null;
    } | null;
  };
}

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [attendances, setAttendances] = useState<GameAttendance[]>([]);
  const [currentUserAttendance, setCurrentUserAttendance] =
    useState<GameAttendance | null>(null);
  const [updatingAttendance, setUpdatingAttendance] = useState<string | null>(
    null
  );
  const [guestName, setGuestName] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const supabase = createClientComponentClient();

  // 戻り先を決定する関数
  const getBackLink = () => {
    const from = searchParams.get("from");

    if (from === "search") {
      return { href: "/search/games", label: "検索結果に戻る" };
    } else if (from === "team") {
      const teamId = searchParams.get("teamId");
      if (teamId) {
        return { href: `/teams/${teamId}`, label: "チーム詳細に戻る" };
      }
    } else if (from === "management") {
      return { href: "/games", label: "試合管理に戻る" };
    }

    // デフォルトはダッシュボード
    return { href: "/dashboard", label: "ダッシュボードに戻る" };
  };

  const backLink = getBackLink();

  useEffect(() => {
    // 認証状態の読み込み中は何もしない
    if (authLoading) return;

    // 認証状態に関わらずデータ取得を試みる
    fetchGameData();
  }, [gameId, user, authLoading]);

  const fetchGameData = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;

      // 未ログイン状態で、かつ試合が終了していない場合はログインページへ
      if (!user && gameData.status !== "completed") {
        router.push("/login");
        return;
      }

      setGame(gameData);

      // チーム情報を取得（home_team_idがある場合）
      if (gameData.home_team_id) {
        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("*")
          .eq("id", gameData.home_team_id)
          .single();

        if (!teamError && teamData) {
          setTeam(teamData);
        }

        // 編集権限とチームメンバー判定（ログインユーザーのみ）
        if (user) {
          let userIsTeamMember = false;

          // ゲーム作成者か確認
          if (gameData.created_by === user.id) {
            setCanEdit(true);
            setIsTeamMember(true);
            userIsTeamMember = true;
          } else {
            // チームメンバーか確認
            const { data: memberData } = await supabase
              .from("team_members")
              .select("*")
              .eq("team_id", gameData.home_team_id)
              .eq("user_id", user.id)
              .single();

            if (memberData) {
              setCanEdit(true);
              setIsTeamMember(true);
              userIsTeamMember = true;
            }
          }

          // チームメンバーのみ出欠確認データを取得
          if (
            userIsTeamMember &&
            gameData.attendance_check_enabled &&
            gameData.home_team_id
          ) {
            // まず出欠データを取得（user_profilesは含めない）
            const { data: attendanceData, error: attendanceError } =
              await supabase
                .from("game_attendances")
                .select(
                  `
                *,
                team_member:team_members!game_attendances_team_member_id_fkey (
                  id,
                  user_id
                )
              `
                )
                .eq("game_id", gameId);

            console.log("Attendance data:", attendanceData);
            console.log("Attendance error:", attendanceError);

            if (
              !attendanceError &&
              attendanceData &&
              attendanceData.length > 0
            ) {
              // user_idのリストを取得
              const userIds = attendanceData
                .map((a: any) => a.team_member?.user_id)
                .filter((id: string) => id);

              // user_profilesを別クエリで取得
              const { data: profilesData } = await supabase
                .from("user_profiles")
                .select("id, display_name")
                .in("id", userIds);

              console.log("Profiles data:", profilesData);

              // 出欠データとプロフィールデータを結合
              const attendanceWithProfiles = attendanceData.map(
                (attendance: any) => {
                  const profile = profilesData?.find(
                    (p) => p.id === attendance.team_member?.user_id
                  );
                  return {
                    ...attendance,
                    team_member: {
                      ...attendance.team_member,
                      user_profiles: profile || null,
                    },
                  };
                }
              );

              // 名前でソート
              const sortedAttendanceData = attendanceWithProfiles.sort(
                (a: any, b: any) => {
                  const nameA =
                    a.team_member?.user_profiles?.display_name || "名前未設定";
                  const nameB =
                    b.team_member?.user_profiles?.display_name || "名前未設定";
                  return nameA.localeCompare(nameB, "ja");
                }
              );

              console.log(
                "Final attendance data with profiles:",
                sortedAttendanceData
              );

              setAttendances(sortedAttendanceData as GameAttendance[]);

              // 現在のユーザーの出欠を探す
              const currentUserData = sortedAttendanceData.find(
                (a: any) => a.team_member?.user_id === user?.id
              );
              console.log("Current user attendance:", currentUserData);
              setCurrentUserAttendance(currentUserData || null);
            } else {
              console.log("出欠データ取得失敗またはデータなし");
              // 出欠データが空の場合も確認
              if (
                !attendanceError &&
                attendanceData &&
                attendanceData.length === 0
              ) {
                console.log("出欠データが空です");
                setAttendances([]);
                setCurrentUserAttendance(null);
              }
            }
          }
        }
      } else {
        // 個人記録の場合は作成者のみ編集可能
        if (user && gameData.created_by === user.id) {
          setCanEdit(true);
        }
      }

      // ゲーム参加メンバーを取得
      const { data: playersData, error: playersError } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .order("batting_order", { ascending: true });

      // デバッグログを追加
      console.log("=== game_players取得結果 ===");
      console.log("playersError:", playersError);
      console.log("playersData:", playersData);
      console.log("gameId:", gameId);
      console.log("user:", user);

      // エラーハンドリングを改善
      if (playersError) {
        console.error("参加メンバー取得エラー詳細:", playersError);
        setGamePlayers([]); // エラーでも空配列を設定
      } else {
        console.log("設定するplayersData:", playersData || []);
        setGamePlayers(playersData || []);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  // 出欠レコードを初期化する関数
  const initializeAttendanceRecords = async () => {
    if (!user || !game?.home_team_id) return;

    try {
      // チームメンバーを取得
      const { data: teamMembers, error: membersError } = await supabase
        .from("team_members")
        .select("id, user_id")
        .eq("team_id", game.home_team_id);

      if (membersError) {
        console.error("チームメンバー取得エラー:", membersError);
        alert("チームメンバーの取得に失敗しました");
        return;
      }

      console.log("チームメンバー:", teamMembers);

      // 既存の出欠レコードを確認
      const { data: existingAttendances, error: existingError } = await supabase
        .from("game_attendances")
        .select("team_member_id")
        .eq("game_id", gameId);

      if (existingError) {
        console.error("既存出欠確認エラー:", existingError);
        alert("既存の出欠確認の確認に失敗しました");
        return;
      }

      console.log("既存の出欠レコード:", existingAttendances);

      // 既存のメンバーIDのセット
      const existingMemberIds = new Set(
        existingAttendances?.map((a) => a.team_member_id) || []
      );

      // 新規メンバーのみフィルタリング
      const newMembers = teamMembers.filter(
        (member) => !existingMemberIds.has(member.id)
      );

      console.log("新規追加メンバー:", newMembers);

      if (newMembers.length === 0) {
        alert("すべてのメンバーの出欠レコードが既に存在します");
        // データを再取得して表示
        await fetchGameData();
        return;
      }

      // 出欠レコードを作成
      const attendanceRecords = newMembers.map((member) => ({
        game_id: gameId,
        team_member_id: member.id,
        status: "pending" as const,
      }));

      console.log("作成する出欠レコード:", attendanceRecords);

      const { data: insertedData, error: insertError } = await supabase
        .from("game_attendances")
        .insert(attendanceRecords)
        .select();

      if (insertError) {
        console.error("出欠レコード作成エラー詳細:", {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
          fullError: insertError,
        });

        // より詳細なエラーメッセージ
        if (insertError.code === "42501") {
          alert("権限がありません。チームメンバーである必要があります。");
        } else if (insertError.code === "23505") {
          alert("既に出欠レコードが存在します。");
        } else {
          alert(`出欠確認の初期化に失敗しました: ${insertError.message}`);
        }
        return;
      }

      console.log("出欠レコード作成成功:", insertedData);

      // 成功したらデータを再取得
      alert("出欠確認を開始しました");
      await fetchGameData();
    } catch (error) {
      console.error("予期しないエラー:", error);
      alert("出欠確認の初期化に失敗しました");
    }
  };

  // 出欠を更新する関数
  const handleAttendanceUpdate = async (
    attendanceId: string,
    newStatus: "attending" | "absent"
  ) => {
    if (!user) return;

    setUpdatingAttendance(attendanceId);

    try {
      const { error } = await supabase
        .from("game_attendances")
        .update({
          status: newStatus,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", attendanceId);

      if (error) throw error;

      // ローカルステートを更新
      setAttendances((prev) =>
        prev.map((a) =>
          a.id === attendanceId
            ? {
                ...a,
                status: newStatus,
                responded_at: new Date().toISOString(),
              }
            : a
        )
      );

      // 現在のユーザーの出欠も更新
      if (currentUserAttendance?.id === attendanceId) {
        setCurrentUserAttendance({
          ...currentUserAttendance,
          status: newStatus,
          responded_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("出欠更新エラー:", error);
      alert("出欠の更新に失敗しました");
    } finally {
      setUpdatingAttendance(null);
    }
  };

  // ゲスト（助っ人・未登録メンバー）を追加する関数
  const addGuestAttendance = async () => {
    if (!guestName.trim()) {
      alert("名前を入力してください");
      return;
    }

    setAddingGuest(true);

    try {
      const { data, error } = await supabase
        .from("game_attendances")
        .insert({
          game_id: gameId,
          person_name: guestName.trim(),
          status: "attending",
          responded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // 成功したらリストに追加
      const newAttendance: GameAttendance = {
        ...data,
        team_member: undefined,
      };

      setAttendances((prev) => [...prev, newAttendance]);
      setGuestName("");
      alert(`${guestName}さんを出席者として追加しました`);
    } catch (error) {
      console.error("ゲスト追加エラー:", error);
      alert("ゲストの追加に失敗しました");
    } finally {
      setAddingGuest(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("本当にこの試合を削除しますか？")) return;

    try {
      const { error } = await supabase.from("games").delete().eq("id", gameId);

      if (error) throw error;

      alert("試合を削除しました");
      router.push(backLink.href);
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">試合が見つかりません</p>
          <Link href={backLink.href} className="text-blue-600 hover:underline">
            {backLink.label}
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    return `${hours}:${minutes}`;
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "official":
        return "bg-red-100 text-red-800";
      case "practice":
        return "bg-blue-100 text-blue-800";
      case "scrimmage":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case "official":
        return "公式戦";
      case "practice":
        return "練習試合";
      case "scrimmage":
        return "紅白戦";
      default:
        return "その他";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* ナビゲーション */}
        <div className="mb-6">
          <Link
            href={backLink.href}
            className="text-blue-600 hover:underline text-sm"
          >
            ← {backLink.label}
          </Link>
        </div>

        {/* 試合情報カード */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* ヘッダー部分 */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {game.name}
                </h1>
                {team && <p className="text-blue-100">チーム: {team.name}</p>}
              </div>
              <div className="flex items-start gap-2">
                {game.category && (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(
                      game.category
                    )}`}
                  >
                    {getCategoryLabel(game.category)}
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    game.status === "completed"
                      ? "bg-gray-100 text-gray-700"
                      : game.status === "in_progress"
                      ? "bg-yellow-100 text-yellow-700"
                      : game.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {game.status === "completed"
                    ? "終了"
                    : game.status === "in_progress"
                    ? "進行中"
                    : game.status === "cancelled"
                    ? "中止"
                    : "予定"}
                </span>
              </div>
            </div>
          </div>

          {/* 基本情報 */}
          <div className="px-6 py-6 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-2">
                  日時
                </h2>
                <p className="text-gray-900">
                  {formatDate(game.game_date)}
                  {game.game_time && ` ${formatTime(game.game_time)}`}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-2">
                  対戦相手
                </h2>
                <p className="text-gray-900">{game.opponent_name}</p>
              </div>

              {game.location && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 mb-2">
                    場所
                  </h2>
                  <p className="text-gray-900">{game.location}</p>
                </div>
              )}
            </div>

            {game.description && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-600 mb-2">
                  説明
                </h2>
                <p className="text-gray-900 whitespace-pre-wrap">
                  {game.description}
                </p>
              </div>
            )}
          </div>

          {/* スコアボード（インラインスコア入力） */}
          <div className="px-6 py-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              スコアボード
            </h2>
            <InlineScoreInput
              gameId={gameId}
              canEdit={canEdit}
              onScoreUpdate={fetchGameData}
            />
          </div>

          {/* 参加メンバー */}
          <div className="px-6 py-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              参加メンバー
            </h2>

            {gamePlayers.length === 0 ? (
              <p className="text-gray-500">メンバー情報はありません</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    スターティングメンバー
                  </h3>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600">
                        <th className="pb-2">打順</th>
                        <th className="pb-2">名前</th>
                        <th className="pb-2">守備</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {gamePlayers
                        .filter((p) => p.is_starter)
                        .sort(
                          (a, b) =>
                            (a.batting_order || 0) - (b.batting_order || 0)
                        )
                        .map((player) => (
                          <tr key={player.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {player.batting_order}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {player.player_name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {player.position || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 運営タスク表示 */}
          <OperationTasksDisplay gameId={gameId} />

          {/* 出欠確認セクション（チームメンバーのみ） */}
          {isTeamMember &&
            game.attendance_check_enabled &&
            game.home_team_id && (
              <div className="px-6 py-6 border-t">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  出欠確認
                </h2>

                {/* 出欠レコードがない場合の初期化ボタン */}
                {attendances.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      出欠確認がまだ開始されていません
                    </p>
                    <button
                      onClick={initializeAttendanceRecords}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      出欠確認を開始する
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 現在のユーザーの出欠回答 */}
                    {currentUserAttendance && (
                      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              あなたの出欠回答
                            </p>
                            <p className="text-lg font-semibold text-gray-900 mt-1">
                              {currentUserAttendance.status === "pending" &&
                                "未回答"}
                              {currentUserAttendance.status === "attending" &&
                                "✅ 出席"}
                              {currentUserAttendance.status === "absent" &&
                                "❌ 欠席"}
                            </p>
                          </div>
                          {currentUserAttendance.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleAttendanceUpdate(
                                    currentUserAttendance.id,
                                    "attending"
                                  )
                                }
                                disabled={
                                  updatingAttendance ===
                                  currentUserAttendance.id
                                }
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                出席する
                              </button>
                              <button
                                onClick={() =>
                                  handleAttendanceUpdate(
                                    currentUserAttendance.id,
                                    "absent"
                                  )
                                }
                                disabled={
                                  updatingAttendance ===
                                  currentUserAttendance.id
                                }
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                欠席する
                              </button>
                            </div>
                          )}
                          {currentUserAttendance.status !== "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleAttendanceUpdate(
                                    currentUserAttendance.id,
                                    currentUserAttendance.status === "attending"
                                      ? "absent"
                                      : "attending"
                                  )
                                }
                                disabled={
                                  updatingAttendance ===
                                  currentUserAttendance.id
                                }
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                              >
                                {currentUserAttendance.status === "attending"
                                  ? "欠席に変更"
                                  : "出席に変更"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 出席者数の警告 */}
                    {attendances.filter((a) => a.status === "attending")
                      .length < 9 && (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800">
                          ⚠️ 現在の出席者は{" "}
                          <span className="font-bold">
                            {
                              attendances.filter(
                                (a) => a.status === "attending"
                              ).length
                            }
                            人
                          </span>
                          です。試合成立には最低9人が必要です。
                        </p>
                      </div>
                    )}

                    {/* メンバーごとの出欠状況 */}
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>
                          出席:{" "}
                          {
                            attendances.filter((a) => a.status === "attending")
                              .length
                          }
                          人
                        </span>
                        <span>
                          欠席:{" "}
                          {
                            attendances.filter((a) => a.status === "absent")
                              .length
                          }
                          人
                        </span>
                        <span>
                          未回答:{" "}
                          {
                            attendances.filter((a) => a.status === "pending")
                              .length
                          }
                          人
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attendances.map((attendance) => (
                          <div
                            key={attendance.id}
                            className={`p-3 rounded-lg border ${
                              attendance.status === "attending"
                                ? "bg-green-50 border-green-200"
                                : attendance.status === "absent"
                                ? "bg-gray-50 border-gray-200"
                                : "bg-yellow-50 border-yellow-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {attendance.person_name ||
                                  attendance.team_member?.user_profiles
                                    ?.display_name ||
                                  "名前未設定"}
                              </span>
                              <span
                                className={`text-sm font-semibold ${
                                  attendance.status === "attending"
                                    ? "text-green-700"
                                    : attendance.status === "absent"
                                    ? "text-gray-600"
                                    : "text-yellow-700"
                                }`}
                              >
                                {attendance.status === "attending" && "出席"}
                                {attendance.status === "absent" && "欠席"}
                                {attendance.status === "pending" && "未回答"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ゲスト（助っ人）追加 */}
                    {canEdit && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                          ゲスト（助っ人）を追加
                        </h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="ゲストの名前"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={addGuestAttendance}
                            disabled={addingGuest || !guestName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {addingGuest ? "追加中..." : "追加"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          {/* スコアボックス形式の成績表示（ここに追加） */}
          {(game.status === "completed" ||
            (user && game.status !== "scheduled")) && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-bold mb-4">試合スコアボックス</h2>
              <ScoreBoxDisplay
                gameId={gameId}
                isEditable={canEdit}
                gameStatus={game.status}
              />
            </div>
          )}

          {/* アクションボタン */}
          {canEdit && (
            <div className="px-6 py-4 bg-gray-50 border-t">
              <div className="flex justify-between">
                {/* 左側のリンク */}
                <div className="flex gap-4">
                  <Link
                    href={`/games/${gameId}/players`}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    メンバー管理
                  </Link>
                  <Link
                    href={`/games/${gameId}/progress`}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    試合進行管理
                  </Link>
                  <Link
                    href={`/games/${gameId}/operations`}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    運営タスク管理
                  </Link>
                </div>

                {/* 右側のボタン */}
                <div className="flex gap-4">
                  <Link
                    href={`/games/${gameId}/edit`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    編集
                  </Link>

                  {/* 削除ボタン */}
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
