"use client";

import { Headline1 } from "@/components/Headline1";
import React, { useState, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// 型定義
interface ScoreUpdate {
  id: string;
  game_id: string;
  team_id: string;
  inning: number;
  score: number | null;
  updated_by: string;
  updated_at: string;
  version: number; // 楽観的ロック用
}

interface TeamScore {
  id: string;
  name: string;
  isHome: boolean;
  scores: (number | null)[];
  totalScore: number;
  hits?: number;
  errors?: number;
}

interface GameDetail {
  id: string;
  date: string;
  gameRule: string;
  gameCategory: string;
  gameStage: string;
  ballpark: string;
  status: "scheduled" | "in_progress" | "completed" | "postponed";
  teams: TeamScore[];
  version: number;
  last_updated: string;
  active_editors: string[]; // 現在編集中のユーザー
}

interface ConflictResolution {
  type: "user_choice" | "latest_wins" | "highest_score_wins";
  show_dialog: boolean;
  conflicting_updates: ScoreUpdate[];
}

interface GameScorePageProps {
  params: {
    gameId: string;
  };
}

export default function RealtimeGameScorePage({ params }: GameScorePageProps) {
  const gameId = params.gameId;
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [isEditing, setIsEditing] = useState<{ [key: string]: boolean }>({});
  const [conflicts, setConflicts] = useState<ConflictResolution | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "error"
  >("disconnected");

  // Supabaseクライアントの初期化（環境変数チェック付き）
  const supabase =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? createClientComponentClient()
      : null;

  // リアルタイム接続の設定
  useEffect(() => {
    let channel: any;

    const setupRealtimeConnection = async () => {
      try {
        // Supabaseが利用できない場合はモックデータで動作
        if (!supabase) {
          console.warn("Supabase not configured, using mock data");
          setConnectionStatus("disconnected");
          await loadMockData();
          return;
        }

        // 現在のユーザー情報を取得
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user.email || user.id);
        }

        // リアルタイムチャンネルの設定
        channel = supabase
          .channel(`game-${gameId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "inning_scores",
              filter: `game_id=eq.${gameId}`,
            },
            handleScoreUpdate
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "games",
              filter: `id=eq.${gameId}`,
            },
            handleGameUpdate
          )
          .on("presence", { event: "sync" }, handlePresenceSync)
          .on("presence", { event: "join" }, handlePresenceJoin)
          .on("presence", { event: "leave" }, handlePresenceLeave)
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              setConnectionStatus("connected");
              // 自分の存在を通知
              await channel.track({
                user: currentUser,
                editing: Object.keys(isEditing).filter((key) => isEditing[key]),
              });
            } else if (status === "CHANNEL_ERROR") {
              setConnectionStatus("error");
            }
          });

        // 初期データの取得
        if (supabase) {
          await fetchGameData();
        }
      } catch (error) {
        console.error("リアルタイム接続エラー:", error);
        setConnectionStatus("error");
      }
    };

    setupRealtimeConnection();

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [gameId]);

  // モックデータの読み込み
  const loadMockData = async () => {
    const mockData: GameDetail = {
      id: gameId,
      date: "2025年7月26日",
      gameRule: "公式戦",
      gameCategory: "GBNリーグ",
      gameStage: "4回戦",
      ballpark: "夢の島公園野球場",
      status: "in_progress",
      version: 1,
      last_updated: new Date().toISOString(),
      active_editors: [],
      teams: [
        {
          id: "mock_team_1",
          name: "EXODUS",
          isHome: false,
          scores: [0, 0, 0, 0, 2, 0, 3, 0, 0],
          totalScore: 5,
          hits: 8,
          errors: 1,
        },
        {
          id: "mock_team_2",
          name: "ダークス",
          isHome: true,
          scores: [0, 1, 1, 3, 0, 2, null, null, null],
          totalScore: 7,
          hits: 10,
          errors: 0,
        },
      ],
    };

    setGameDetail(mockData);
    setConnectionStatus("disconnected");
  };

  // スコア更新のハンドリング
  const handleScoreUpdate = useCallback((payload: any) => {
    const { new: newScore, old: oldScore, eventType } = payload;

    setGameDetail((prev) => {
      if (!prev) return prev;

      // 競合検出
      if (oldScore && newScore.version <= oldScore.version) {
        // 競合が発生した場合の処理
        setConflicts({
          type: "user_choice",
          show_dialog: true,
          conflicting_updates: [newScore, oldScore],
        });
        return prev;
      }

      // スコアの更新
      const updatedTeams = prev.teams.map((team) => {
        if (team.id === newScore.team_id) {
          const newScores = [...team.scores];
          newScores[newScore.inning - 1] = newScore.score;

          return {
            ...team,
            scores: newScores,
            totalScore: newScores.reduce((sum, score) => sum + (score || 0), 0),
          };
        }
        return team;
      });

      return {
        ...prev,
        teams: updatedTeams,
        version: newScore.version,
        last_updated: newScore.updated_at,
      };
    });
  }, []);

  // 試合情報更新のハンドリング
  const handleGameUpdate = useCallback((payload: any) => {
    const { new: newGame } = payload;
    setGameDetail((prev) => (prev ? { ...prev, ...newGame } : null));
  }, []);

  // プレゼンス（誰が編集中か）のハンドリング
  const handlePresenceSync = useCallback(() => {
    // 現在のプレゼンス状態を取得
  }, []);

  const handlePresenceJoin = useCallback((payload: any) => {
    console.log("ユーザーが参加:", payload);
  }, []);

  const handlePresenceLeave = useCallback((payload: any) => {
    console.log("ユーザーが離脱:", payload);
  }, []);

  // 初期データの取得
  const fetchGameData = async () => {
    if (!supabase) {
      await loadMockData();
      return;
    }

    try {
      const { data: game, error } = await supabase
        .from("games")
        .select(
          `
          *,
          game_teams (
            *,
            teams (*),
            inning_scores (*)
          )
        `
        )
        .eq("id", gameId)
        .single();

      if (error) throw error;

      // データを整形
      const formattedGame: GameDetail = {
        id: game.id,
        date: game.date,
        gameRule: game.game_rule,
        gameCategory: game.game_category,
        gameStage: game.game_stage,
        ballpark: game.ballpark,
        status: game.status,
        version: game.version || 1,
        last_updated: game.updated_at,
        active_editors: [],
        teams: game.game_teams.map((gt: any) => ({
          id: gt.team_id,
          name: gt.teams.name,
          isHome: gt.is_home,
          scores: Array.from({ length: 9 }, (_, i) => {
            const inningScore = gt.inning_scores.find(
              (is: any) => is.inning === i + 1
            );
            return inningScore ? inningScore.score : null;
          }),
          totalScore: gt.total_score || 0,
          hits: gt.hits || 0,
          errors: gt.errors || 0,
        })),
      };

      setGameDetail(formattedGame);
    } catch (error) {
      console.error("データ取得エラー:", error);
    }
  };

  // スコア更新（楽観的ロック付き）
  const updateScore = async (
    teamId: string,
    inning: number,
    newScore: number | null
  ) => {
    if (!gameDetail) return;

    // Supabaseが利用できない場合はローカル状態のみ更新
    if (!supabase) {
      setGameDetail((prev) => {
        if (!prev) return prev;

        const updatedTeams = prev.teams.map((team) => {
          if (team.id === teamId) {
            const newScores = [...team.scores];
            newScores[inning - 1] = newScore;

            return {
              ...team,
              scores: newScores,
              totalScore: newScores.reduce(
                (sum, score) => sum + (score || 0),
                0
              ),
            };
          }
          return team;
        });

        return { ...prev, teams: updatedTeams };
      });
      return;
    }

    try {
      // 楽観的ロック: 現在のバージョンを確認
      const { data: currentData, error: fetchError } = await supabase
        .from("inning_scores")
        .select("version")
        .eq("game_team_id", teamId)
        .eq("inning", inning)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // データが存在しない場合以外
        throw fetchError;
      }

      const currentVersion = currentData?.version || 0;

      // スコアの更新（バージョンチェック付き）
      const { error: updateError } = await supabase
        .from("inning_scores")
        .upsert({
          game_team_id: teamId,
          inning,
          score: newScore,
          updated_by: currentUser,
          version: currentVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("version", currentVersion); // 楽観的ロック

      if (updateError) {
        if (updateError.message.includes("version")) {
          // バージョン競合が発生
          await handleVersionConflict(teamId, inning, newScore);
        } else {
          throw updateError;
        }
      }

      // 合計スコアの更新
      await updateTotalScore(teamId);
    } catch (error) {
      console.error("スコア更新エラー:", error);
      // エラー通知をユーザーに表示
    }
  };

  // バージョン競合の処理
  const handleVersionConflict = async (
    teamId: string,
    inning: number,
    newScore: number | null
  ) => {
    // 最新データを取得して競合解決ダイアログを表示
    const { data: latestData } = await supabase
      .from("inning_scores")
      .select("*")
      .eq("game_team_id", teamId)
      .eq("inning", inning)
      .single();

    setConflicts({
      type: "user_choice",
      show_dialog: true,
      conflicting_updates: [
        {
          id: "current",
          game_id: gameId,
          team_id: teamId,
          inning,
          score: newScore,
          updated_by: currentUser,
          updated_at: new Date().toISOString(),
          version: 0,
        },
        latestData,
      ],
    });
  };

  // 合計スコアの更新
  const updateTotalScore = async (teamId: string) => {
    const { data: inningScores } = await supabase
      .from("inning_scores")
      .select("score")
      .eq("game_team_id", teamId);

    const totalScore =
      inningScores?.reduce((sum, is) => sum + (is.score || 0), 0) || 0;

    await supabase
      .from("game_teams")
      .update({ total_score: totalScore })
      .eq("team_id", teamId)
      .eq("game_id", gameId);
  };

  // 編集状態の管理
  const startEditing = (key: string) => {
    setIsEditing((prev) => ({ ...prev, [key]: true }));
  };

  const stopEditing = (key: string) => {
    setIsEditing((prev) => ({ ...prev, [key]: false }));
  };

  // 競合解決
  const resolveConflict = async (
    resolution: "keep_mine" | "keep_theirs" | "merge"
  ) => {
    if (!conflicts) return;

    const [myUpdate, theirUpdate] = conflicts.conflicting_updates;

    switch (resolution) {
      case "keep_mine":
        await updateScore(myUpdate.team_id, myUpdate.inning, myUpdate.score);
        break;
      case "keep_theirs":
        // 何もしない（相手の更新を受け入れる）
        break;
      case "merge":
        // カスタム競合解決ロジック
        break;
    }

    setConflicts(null);
  };

  if (!gameDetail) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        読み込み中...
      </div>
    );
  }

  return (
    <>
      <Headline1>リアルタイム試合スコア入力</Headline1>

      {/* 接続状況表示 */}
      <div className="mb-4 flex items-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionStatus === "connected"
              ? "bg-green-500"
              : connectionStatus === "error"
              ? "bg-red-500"
              : "bg-yellow-500"
          }`}
        ></div>
        <span className="text-sm text-gray-600">
          {connectionStatus === "connected"
            ? "接続中"
            : connectionStatus === "error"
            ? "接続エラー"
            : "接続中..."}
        </span>
        {gameDetail.active_editors.length > 0 && (
          <span className="text-xs text-blue-600">
            編集中: {gameDetail.active_editors.join(", ")}
          </span>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* スコアテーブル（編集可能） */}
        <div className="overflow-x-auto shadow-lg rounded-lg">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-3 text-left font-semibold">
                  チーム名
                </th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th
                    key={i + 1}
                    className="border border-gray-300 px-2 py-3 text-center font-semibold min-w-[50px]"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="border border-gray-300 px-3 py-3 text-center font-bold bg-yellow-100">
                  R
                </th>
              </tr>
            </thead>
            <tbody>
              {gameDetail.teams.map((team) => (
                <tr
                  key={team.id}
                  className={team.isHome ? "bg-blue-50" : "bg-red-50"}
                >
                  <th className="border border-gray-300 px-3 py-3 text-left font-semibold">
                    {team.name} {team.isHome ? "(後攻)" : "(先攻)"}
                  </th>
                  {team.scores.map((score, inningIndex) => {
                    const key = `${team.id}-${inningIndex + 1}`;
                    return (
                      <td
                        key={inningIndex + 1}
                        className="border border-gray-300 px-1 py-2"
                      >
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={score || ""}
                          onChange={(e) => {
                            const newScore =
                              e.target.value === ""
                                ? null
                                : parseInt(e.target.value);
                            updateScore(team.id, inningIndex + 1, newScore);
                          }}
                          onFocus={() => startEditing(key)}
                          onBlur={() => stopEditing(key)}
                          className={`w-full text-center border-0 bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded ${
                            isEditing[key] ? "bg-yellow-100" : ""
                          }`}
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 px-3 py-3 text-center font-bold text-lg bg-yellow-50">
                    {team.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 競合解決ダイアログ */}
        {conflicts?.show_dialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md mx-4">
              <h3 className="text-lg font-bold mb-4">
                スコア競合が発生しました
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                別のユーザーが同時にスコアを更新しました。どちらを採用しますか？
              </p>
              <div className="space-y-2 mb-4">
                <div>
                  あなたの更新: {conflicts.conflicting_updates[0]?.score}
                </div>
                <div>相手の更新: {conflicts.conflicting_updates[1]?.score}</div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => resolveConflict("keep_mine")}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  自分のを採用
                </button>
                <button
                  onClick={() => resolveConflict("keep_theirs")}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  相手のを採用
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
