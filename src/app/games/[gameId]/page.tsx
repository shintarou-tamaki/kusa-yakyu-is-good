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
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  home_score: number;
  opponent_score: number;
  record_type: "team" | "personal";
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
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

interface PageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function GameDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canViewDetails, setCanViewDetails] = useState(false);

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchGameDetails();
  }, [gameId, user]);

  const fetchGameDetails = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error("試合取得エラー:", gameError);
        setLoading(false);
        return;
      }

      setGame(gameData);

      // チーム情報を取得
      if (gameData.home_team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("id", gameData.home_team_id)
          .single();

        if (teamData) {
          setTeam(teamData);
        }
      }

      // 試合参加メンバーを取得
      const { data: playersData } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .eq("is_active", true)
        .order("is_starter", { ascending: false })
        .order("batting_order", { ascending: true });

      if (playersData) {
        setGamePlayers(playersData);
      }

      // 権限チェック
      if (user) {
        const owner = gameData.created_by === user.id;
        setIsOwner(owner);

        // チームオーナーか確認
        if (gameData.home_team_id) {
          const { data: teamOwnerData } = await supabase
            .from("teams")
            .select("owner_id")
            .eq("id", gameData.home_team_id)
            .single();

          const teamOwner = teamOwnerData?.owner_id === user.id;

          // チームメンバーか確認
          const { data: memberCheck } = await supabase
            .from("team_members")
            .select("id")
            .eq("team_id", gameData.home_team_id)
            .eq("user_id", user.id)
            .single();

          const isMember = !!memberCheck;

          setCanEdit(owner || teamOwner);
          setCanViewDetails(owner || teamOwner || isMember || gameData.is_public);
        } else {
          // 個人記録の場合
          setCanEdit(owner);
          setCanViewDetails(owner || gameData.is_public);
        }
      } else {
        // 未ログインユーザー
        setCanViewDetails(gameData.is_public);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit || !game) return;

    try {
      const { error } = await supabase
        .from("games")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", gameId);

      if (error) {
        console.error("ステータス更新エラー:", error);
        alert("ステータスの更新に失敗しました");
        return;
      }

      setGame({ ...game, status: newStatus as Game["status"] });
    } catch (error) {
      console.error("エラー:", error);
      alert("予期しないエラーが発生しました");
    }
  };

  const handleDelete = async () => {
    if (!confirm("本当にこの試合を削除しますか？この操作は取り消せません。")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("games")
        .delete()
        .eq("id", gameId);

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

  if (!game || !canViewDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {!game ? "試合が見つかりません" : "この試合の詳細を表示する権限がありません"}
          </p>
          <Link href="/games" className="text-blue-600 hover:text-blue-700">
            試合一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { label: "予定", className: "bg-blue-100 text-blue-800" },
      in_progress: { label: "進行中", className: "bg-yellow-100 text-yellow-800" },
      completed: { label: "完了", className: "bg-green-100 text-green-800" },
      cancelled: { label: "中止", className: "bg-gray-100 text-gray-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled;

    return (
      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // スターティングメンバーと控えメンバーを分離
  const starters = gamePlayers.filter(p => p.is_starter);
  const substitutes = gamePlayers.filter(p => !p.is_starter);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link
            href="/games"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            試合一覧に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow">
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{game.name}</h1>
                <div className="mt-2 flex items-center space-x-4">
                  {getStatusBadge(game.status)}
                  <span className="text-sm text-gray-500">
                    {game.record_type === "team" ? "チーム記録" : "個人記録"}
                  </span>
                  {!game.is_public && (
                    <span className="text-sm text-gray-500">🔒 非公開</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* スコア表示（進行中または完了の場合） */}
          {(game.status === "in_progress" || game.status === "completed") && (
            <div className="px-6 py-6 border-b bg-gray-50">
              <div className="flex justify-center items-center space-x-8">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">
                    {team ? team.name : "マイチーム"}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{game.home_score}</p>
                </div>
                <div className="text-2xl text-gray-400">-</div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">{game.opponent_name}</p>
                  <p className="text-3xl font-bold text-gray-900">{game.opponent_score}</p>
                </div>
              </div>
            </div>
          )}

          {/* 詳細情報 */}
          <div className="px-6 py-6 space-y-6">
            {/* 基本情報 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">試合情報</h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-600">日時</dt>
                  <dd className="text-gray-900 mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(game.game_date).toLocaleDateString("ja-JP")}
                    {game.game_time && ` ${game.game_time}`}
                  </dd>
                </div>
                {game.location && (
                  <div>
                    <dt className="text-sm text-gray-600">場所</dt>
                    <dd className="text-gray-900 mt-1 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {game.location}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-gray-600">対戦相手</dt>
                  <dd className="text-gray-900 mt-1">{game.opponent_name}</dd>
                </div>
                {team && (
                  <div>
                    <dt className="text-sm text-gray-600">チーム</dt>
                    <dd className="mt-1">
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {team.name}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 試合参加メンバー */}
            {(starters.length > 0 || substitutes.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">試合参加メンバー</h2>
                  {canEdit && (
                    <Link
                      href={`/games/${gameId}/players`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      メンバー管理 →
                    </Link>
                  )}
                </div>

                {/* スターティングメンバー */}
                {starters.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">スターティングメンバー</h3>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {starters.map((player) => (
                          <div key={player.id} className="flex items-center text-sm">
                            {player.batting_order && (
                              <span className="font-medium mr-2">
                                {player.batting_order}.
                              </span>
                            )}
                            <span className="flex-1">{player.player_name}</span>
                            {player.position && (
                              <span className="text-gray-500 ml-2">
                                ({player.position})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 控えメンバー */}
                {substitutes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">控えメンバー</h3>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex flex-wrap gap-2">
                        {substitutes.map((player) => (
                          <span key={player.id} className="text-sm text-gray-700">
                            {player.player_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* メモ・備考 */}
            {game.description && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ・備考</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{game.description}</p>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          {canEdit && (
            <div className="border-t px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {/* メンバー管理ボタン */}
                <Link
                  href={`/games/${gameId}/players`}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  メンバー管理
                </Link>

                {/* ステータス変更ボタン */}
                {game.status === "scheduled" && (
                  <>
                    <button
                      onClick={() => handleStatusChange("in_progress")}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                    >
                      試合開始
                    </button>
                    <button
                      onClick={() => handleStatusChange("cancelled")}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      中止にする
                    </button>
                  </>
                )}
                {game.status === "in_progress" && (
                  <button
                    onClick={() => handleStatusChange("completed")}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    試合終了
                  </button>
                )}

                {/* スコア入力ボタン */}
                {(game.status === "in_progress" || game.status === "completed") && (
                  <Link
                    href={`/games/${gameId}/score`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    スコア入力
                  </Link>
                )}

                {/* 編集・削除ボタン */}
                <Link
                  href={`/games/${gameId}/edit`}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  編集
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  削除
                </button>
              </div>
            </div>
          )}

          {/* メタ情報 */}
          <div className="mt-8 pt-6 border-t px-6 pb-6 text-sm text-gray-500">
            <p>作成日: {new Date(game.created_at).toLocaleDateString("ja-JP")}</p>
            {game.updated_at !== game.created_at && (
              <p>更新日: {new Date(game.updated_at).toLocaleDateString("ja-JP")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}