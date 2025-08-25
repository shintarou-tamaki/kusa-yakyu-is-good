"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface InlineScoreInputProps {
  gameId: string;
  canEdit: boolean;
  onScoreUpdate?: () => void;
}

interface ScoreData {
  inning: number;
  top_score: number | null;
  bottom_score: number | null;
}

interface Game {
  id: string;
  home_team_id: string;
  home_score: number;
  opponent_score: number;
  status: string;
}

export default function InlineScoreInput({
  gameId,
  canEdit,
  onScoreUpdate,
}: InlineScoreInputProps) {
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [isMyTeamBatFirst, setIsMyTeamBatFirst] = useState<boolean>(true);
  const [totalInnings, setTotalInnings] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchGameAndScores();
  }, [gameId]);

  const fetchGameAndScores = async () => {
    try {
      // 試合情報を取得
      const { data: gameData } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData);
      }

      // 既存のスコアを取得
      const { data: scoresData } = await supabase
        .from("game_scores")
        .select("*")
        .eq("game_id", gameId)
        .order("inning", { ascending: true });

      if (scoresData && scoresData.length > 0) {
        // 先攻/後攻の設定を取得
        const firstScore = scoresData[0];
        if (firstScore.is_my_team_bat_first !== null) {
          setIsMyTeamBatFirst(firstScore.is_my_team_bat_first);
        }

        // スコアデータを設定
        const maxInning = Math.max(...scoresData.map((s) => s.inning));
        setTotalInnings(Math.max(7, maxInning));

        // 全イニングのデータを作成
        const allScores: ScoreData[] = [];
        for (let i = 1; i <= Math.max(7, maxInning); i++) {
          const existing = scoresData.find((s) => s.inning === i);
          allScores.push({
            inning: i,
            top_score: existing?.top_score ?? null,
            bottom_score: existing?.bottom_score ?? null,
          });
        }
        setScores(allScores);
      } else {
        // 初期データを作成
        initializeScores(7);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeScores = (innings: number) => {
    const newScores: ScoreData[] = [];
    for (let i = 1; i <= innings; i++) {
      newScores.push({
        inning: i,
        top_score: null,
        bottom_score: null,
      });
    }
    setScores(newScores);
  };

  const handleScoreChange = (inning: number, isTop: boolean, value: string) => {
    const numValue = value === "" ? null : parseInt(value);
    setScores((prev) =>
      prev.map((s) =>
        s.inning === inning
          ? { ...s, [isTop ? "top_score" : "bottom_score"]: numValue }
          : s
      )
    );
  };

  const addInning = () => {
    if (totalInnings < 12) {
      setTotalInnings((prev) => prev + 1);
      setScores((prev) => [
        ...prev,
        {
          inning: prev.length + 1,
          top_score: null,
          bottom_score: null,
        },
      ]);
    }
  };

  const removeLastInning = () => {
    if (
      totalInnings > 7 &&
      scores[totalInnings - 1].top_score === null &&
      scores[totalInnings - 1].bottom_score === null
    ) {
      setTotalInnings((prev) => prev - 1);
      setScores((prev) => prev.slice(0, -1));
    }
  };

  const calculateTotal = (isTop: boolean) => {
    return scores.reduce((sum, s) => {
      const score = isTop ? s.top_score : s.bottom_score;
      return sum + (score || 0);
    }, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 既存のスコアを削除
      await supabase.from("game_scores").delete().eq("game_id", gameId);

      // 新しいスコアを挿入
      const scoresToInsert = scores
        .filter((s) => s.top_score !== null || s.bottom_score !== null)
        .map((s) => ({
          game_id: gameId,
          inning: s.inning,
          top_score: s.top_score,
          bottom_score: s.bottom_score,
          is_my_team_bat_first: isMyTeamBatFirst,
        }));

      if (scoresToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("game_scores")
          .insert(scoresToInsert);

        if (insertError) throw insertError;
      }

      // 試合の合計スコアを更新
      const homeTotal = isMyTeamBatFirst
        ? calculateTotal(true)
        : calculateTotal(false);
      const opponentTotal = isMyTeamBatFirst
        ? calculateTotal(false)
        : calculateTotal(true);

      const { error: updateError } = await supabase
        .from("games")
        .update({
          home_score: homeTotal,
          opponent_score: opponentTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (updateError) throw updateError;

      setEditMode(false);
      if (onScoreUpdate) {
        onScoreUpdate();
      }

      // 試合情報を再取得
      fetchGameAndScores();
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const myTeamLabel = isMyTeamBatFirst ? "表（先攻）" : "裏（後攻）";
  const opponentLabel = isMyTeamBatFirst ? "裏（後攻）" : "表（先攻）";

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">スコアボード</h3>
        {canEdit && !editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            スコア編集
          </button>
        )}
        {canEdit && editMode && (
          <div className="flex space-x-2">
            <button
              onClick={() => setEditMode(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </div>

      {/* 編集モード時の先攻/後攻選択 */}
      {editMode && (
        <div className="px-6 py-3 bg-blue-50 border-b">
          <label className="text-sm font-medium text-gray-700">
            マイチームは：
            <select
              value={isMyTeamBatFirst ? "first" : "second"}
              onChange={(e) => setIsMyTeamBatFirst(e.target.value === "first")}
              className="ml-2 px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="first">先攻</option>
              <option value="second">後攻</option>
            </select>
          </label>
        </div>
      )}

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">
                  回
                </th>
                {scores.map((_, index) => (
                  <th
                    key={index}
                    className="px-3 py-2 text-center text-sm font-medium text-gray-700 min-w-[50px]"
                  >
                    {index + 1}
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-sm font-bold text-gray-900 bg-gray-100">
                  計
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 表（先攻） */}
              <tr className="border-b">
                <td className="px-3 py-2 text-sm font-medium text-gray-700">
                  {isMyTeamBatFirst ? "マイチーム" : "相手"}
                </td>
                {scores.map((score) => (
                  <td key={score.inning} className="px-3 py-2 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={score.top_score ?? ""}
                        onChange={(e) =>
                          handleScoreChange(score.inning, true, e.target.value)
                        }
                        className="w-12 px-1 py-1 text-center border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <span className="text-sm">{score.top_score ?? "-"}</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-lg font-bold bg-gray-100">
                  {calculateTotal(true)}
                </td>
              </tr>

              {/* 裏（後攻） */}
              <tr className="border-b">
                <td className="px-3 py-2 text-sm font-medium text-gray-700">
                  {!isMyTeamBatFirst ? "マイチーム" : "相手"}
                </td>
                {scores.map((score) => (
                  <td key={score.inning} className="px-3 py-2 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={score.bottom_score ?? ""}
                        onChange={(e) =>
                          handleScoreChange(score.inning, false, e.target.value)
                        }
                        className="w-12 px-1 py-1 text-center border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <span className="text-sm">
                        {score.bottom_score ?? "-"}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-lg font-bold bg-gray-100">
                  {calculateTotal(false)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 延長回の追加/削除 */}
        {editMode && (
          <div className="mt-4 flex justify-end space-x-2">
            {totalInnings > 7 && (
              <button
                onClick={removeLastInning}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                最終回を削除
              </button>
            )}
            {totalInnings < 12 && (
              <button
                onClick={addInning}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                延長回を追加
              </button>
            )}
          </div>
        )}

        {/* 試合結果表示 */}
        {!editMode && game && game.status === "completed" && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-lg font-bold">
              {game.home_score > game.opponent_score ? (
                <span className="text-blue-600">勝利！</span>
              ) : game.home_score < game.opponent_score ? (
                <span className="text-red-600">敗北</span>
              ) : (
                <span className="text-gray-600">引き分け</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
