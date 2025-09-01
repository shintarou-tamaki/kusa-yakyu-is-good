"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { calculateBaseReached, isOutResult, advanceRunners } from "@/lib/game-logic";

interface BattingInputModalProps {
  gameId: string;
  playerId: string;
  playerName: string;
  inning: number;
  existingRecord?: {
    id: string;
    result: string;
    rbi: number;
    run_scored: boolean;
    stolen_base: boolean;
    base_reached?: number;
    notes?: string;
  };
  onClose: () => void;
  onSave: () => void;
}

interface Runner {
  id: string;
  player_id: string;
  player_name: string;
  current_base: number;
}

const BATTING_RESULTS = [
  { value: "安打", label: "安打" },
  { value: "二塁打", label: "二塁打" },
  { value: "三塁打", label: "三塁打" },
  { value: "本塁打", label: "本塁打" },
  { value: "四球", label: "四球" },
  { value: "死球", label: "死球" },
  { value: "三振", label: "三振" },
  { value: "ゴロ", label: "ゴロ" },
  { value: "フライ", label: "フライ" },
  { value: "ライナー", label: "ライナー" },
  { value: "犠打", label: "犠打" },
  { value: "犠飛", label: "犠飛" },
  { value: "フィールダースチョイス", label: "野選" },
];

const FIELD_POSITIONS = [
  { value: "投", label: "投手" },
  { value: "捕", label: "捕手" },
  { value: "一", label: "一塁" },
  { value: "二", label: "二塁" },
  { value: "三", label: "三塁" },
  { value: "遊", label: "遊撃" },
  { value: "左", label: "左翼" },
  { value: "中", label: "中堅" },
  { value: "右", label: "右翼" },
];

export default function BattingInputModal({
  gameId,
  playerId,
  playerName,
  inning,
  existingRecord,
  onClose,
  onSave,
}: BattingInputModalProps) {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [currentRunners, setCurrentRunners] = useState<Runner[]>([]);
  const [currentOuts, setCurrentOuts] = useState(0);
  
  // フォーム状態
  const [result, setResult] = useState(existingRecord?.result || "");
  const [fieldPosition, setFieldPosition] = useState("");
  const [isError, setIsError] = useState(false);
  const [isDoublePlay, setIsDoublePlay] = useState(false);
  const [isTriplePlay, setIsTriplePlay] = useState(false);
  const [rbi, setRbi] = useState(existingRecord?.rbi || 0);
  const [runScored, setRunScored] = useState(existingRecord?.run_scored || false);
  const [stolenBase, setStolenBase] = useState(existingRecord?.stolen_base || false);
  const [baseReached, setBaseReached] = useState(existingRecord?.base_reached || 0);
  
  // 併殺処理用
  const [showDoublePlaySelector, setShowDoublePlaySelector] = useState(false);
  const [selectedRunners, setSelectedRunners] = useState<string[]>([]);

  useEffect(() => {
    fetchCurrentRunners();
    fetchCurrentOuts();
  }, [gameId, inning]);

  useEffect(() => {
    // 打撃結果に応じて到達塁を自動計算
    const calculatedBase = calculateBaseReached(result, isError);
    setBaseReached(calculatedBase);
    
    // アウトの場合は得点をリセット
    if (isOutResult(result) && !isError) {
      setRunScored(false);
    }
    
    // ゴロの場合で併殺可能かチェック
    if (result === "ゴロ" && currentRunners.length > 0) {
      setShowDoublePlaySelector(true);
    } else {
      setShowDoublePlaySelector(false);
      setSelectedRunners([]);
    }
  }, [result, isError, currentRunners]);

  const fetchCurrentRunners = async () => {
    const { data } = await supabase
      .from("game_runners")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", inning)
      .eq("is_active", true)
      .in("current_base", [1, 2, 3]);
    
    if (data) {
      setCurrentRunners(data);
    }
  };

  const fetchCurrentOuts = async () => {
    const { data } = await supabase
      .from("game_batting_records")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", inning);
    
    if (data) {
      let outs = 0;
      data.forEach((record) => {
        if (isOutResult(record.result)) {
          if (record.notes?.includes("併殺")) {
            outs += 2;
          } else if (record.notes?.includes("三重殺")) {
            outs += 3;
          } else {
            outs += 1;
          }
        }
      });
      setCurrentOuts(outs);
    }
  };

  const handleRunnerToggle = (runnerId: string) => {
    setSelectedRunners((prev) => {
      if (prev.includes(runnerId)) {
        return prev.filter((id) => id !== runnerId);
      } else {
        // 最大2人まで選択可能（三重殺の場合）
        if (prev.length >= 2) {
          return [...prev.slice(1), runnerId];
        }
        return [...prev, runnerId];
      }
    });
  };

  const updateInningScore = async () => {
    // イニングの得点を計算して更新
    const { data: scoredRuns } = await supabase
      .from("game_batting_records")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", inning)
      .eq("run_scored", true);
    
    const runs = scoredRuns?.length || 0;
    
    // game_scoresテーブルを更新
    await supabase
      .from("game_scores")
      .upsert({
        game_id: gameId,
        inning,
        top_score: runs, // TODO: 先攻/後攻の判定が必要
        bottom_score: 0,
        is_my_team_bat_first: true, // TODO: 実際の値を取得
      }, {
        onConflict: "game_id,inning"
      });
  };

  const handleSave = async () => {
    if (!result) {
      alert("打撃結果を選択してください");
      return;
    }

    setLoading(true);
    
    try {
      // 併殺・三重殺の処理
      if (showDoublePlaySelector && selectedRunners.length > 0) {
        // 選択されたランナーをアウトに
        await supabase
          .from("game_runners")
          .update({ is_active: false })
          .in("id", selectedRunners);
        
        // notesに併殺情報を追加
        if (selectedRunners.length === 1) {
          setIsDoublePlay(true);
        } else if (selectedRunners.length === 2) {
          setIsTriplePlay(true);
        }
      }
      
      // notesの構築
      const notes = buildNotes();
      
      // 打撃記録の保存/更新
      const battingData = {
        game_id: gameId,
        player_id: playerId,
        inning,
        result,
        rbi,
        run_scored: runScored,
        stolen_base: stolenBase,
        base_reached: baseReached,
        notes,
      };

      if (existingRecord) {
        await supabase
          .from("game_batting_records")
          .update(battingData)
          .eq("id", existingRecord.id);
      } else {
        await supabase
          .from("game_batting_records")
          .insert([battingData]);
      }

      // ランナー進塁処理
      if (!isOutResult(result) || isError) {
        await advanceRunners(supabase, gameId, inning, baseReached);
        
        // 打者をランナーとして追加（ホームイン以外）
        if (baseReached > 0 && baseReached < 4) {
          // 既存のランナー記録を削除
          await supabase
            .from("game_runners")
            .delete()
            .eq("game_id", gameId)
            .eq("player_id", playerId)
            .eq("inning", inning);

          // 新規追加
          await supabase
            .from("game_runners")
            .insert([{
              game_id: gameId,
              player_id: playerId,
              player_name: playerName,
              inning,
              current_base: baseReached,
              is_active: true,
            }]);
        }
      }
      
      // イニング得点の更新
      await updateInningScore();
      
      // アウトカウントチェック
      const totalOuts = currentOuts + (isOutResult(result) ? 1 : 0) + selectedRunners.length;
      if (totalOuts >= 3) {
        // 3アウトでランナーをクリア
        await supabase
          .from("game_runners")
          .update({ is_active: false })
          .eq("game_id", gameId)
          .eq("inning", inning);
        
        alert("3アウトチェンジ！");
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const buildNotes = () => {
    const notes = [];
    if (fieldPosition) notes.push(fieldPosition);
    if (isError) notes.push("失策");
    if (isDoublePlay || selectedRunners.length === 1) notes.push("併殺");
    if (isTriplePlay || selectedRunners.length === 2) notes.push("三重殺");
    return notes.join(",");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {inning}回 {playerName} の打席結果
          </h2>
          <div className="text-sm text-gray-600">
            現在 {currentOuts} アウト
          </div>
        </div>

        {/* 現在のランナー表示 */}
        {currentRunners.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <p className="font-semibold mb-2">現在のランナー</p>
            <div className="flex space-x-4">
              {currentRunners.map((runner) => (
                <span key={runner.id} className="text-sm">
                  {runner.current_base}塁: {runner.player_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 打撃結果選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">打撃結果 *</label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">選択してください</option>
            {BATTING_RESULTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* 併殺選択（ゴロの場合） */}
        {showDoublePlaySelector && currentRunners.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 rounded">
            <p className="font-semibold mb-2">併殺プレーの選択</p>
            <p className="text-sm text-gray-600 mb-2">
              アウトになるランナーを選択してください（打者は自動的にアウト）
            </p>
            <div className="space-y-2">
              {currentRunners.map((runner) => (
                <label key={runner.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRunners.includes(runner.id)}
                    onChange={() => handleRunnerToggle(runner.id)}
                    className="mr-2"
                  />
                  {runner.current_base}塁: {runner.player_name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 守備位置選択（アウトの場合） */}
        {isOutResult(result) && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">守備位置</label>
            <select
              value={fieldPosition}
              onChange={(e) => setFieldPosition(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">選択してください</option>
              {FIELD_POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* オプション（アウトの場合のみエラー出塁を表示） */}
        {isOutResult(result) && (
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isError}
                onChange={(e) => setIsError(e.target.checked)}
                className="mr-2"
              />
              エラー出塁
            </label>
          </div>
        )}

        {/* 打点・得点・盗塁 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">打点</label>
            <input
              type="number"
              min="0"
              max="4"
              value={rbi}
              onChange={(e) => setRbi(parseInt(e.target.value) || 0)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={runScored}
                onChange={(e) => setRunScored(e.target.checked)}
                className="mr-2"
              />
              得点
            </label>
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={stolenBase}
                onChange={(e) => setStolenBase(e.target.checked)}
                className="mr-2"
              />
              盗塁
            </label>
          </div>
        </div>

        {/* 到達塁表示 */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm">
            到達塁: {
              baseReached === 0 ? "アウト" :
              baseReached === 1 ? "一塁" :
              baseReached === 2 ? "二塁" :
              baseReached === 3 ? "三塁" :
              baseReached === 4 ? "ホーム" : "-"
            }
            {selectedRunners.length > 0 && (
              <span className="ml-2 text-red-600">
                （{selectedRunners.length === 1 ? "併殺" : "三重殺"}）
              </span>
            )}
          </p>
        </div>

        {/* ボタン */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
            disabled={loading}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
            disabled={loading || !result}
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}