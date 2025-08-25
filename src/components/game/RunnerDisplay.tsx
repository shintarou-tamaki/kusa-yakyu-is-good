"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Runner {
  id: string;
  game_id: string;
  inning: number;
  player_id: string;
  player_name: string;
  current_base: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  gameId: string;
  currentInning: number;
  onRunnerUpdate?: () => void;
  refreshTrigger?: number;
}

export default function RunnerDisplay({
  gameId,
  currentInning,
  onRunnerUpdate,
  refreshTrigger,
}: Props) {
  const supabase = createClientComponentClient();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRunners();
  }, [gameId, currentInning, refreshTrigger]);

  const fetchRunners = async () => {
    try {
      // アクティブなランナーを取得
      const { data, error } = await supabase
        .from("game_runners")
        .select("*")
        .eq("game_id", gameId)
        .eq("inning", currentInning)
        .eq("is_active", true)
        .in("current_base", [1, 2, 3]);

      if (error) throw error;

      // 重複を除去（同じ選手が複数いる場合は最新のもののみ残す）
      const uniqueRunners = new Map<string, Runner>();
      if (data) {
        for (const runner of data) {
          const existing = uniqueRunners.get(runner.player_id);
          if (
            !existing ||
            new Date(runner.updated_at || runner.created_at) >
              new Date(existing.updated_at || existing.created_at)
          ) {
            uniqueRunners.set(runner.player_id, runner);
          }
        }

        // 古い重複レコードを削除
        const uniqueIds = Array.from(uniqueRunners.values()).map((r) => r.id);
        const duplicateIds = data
          .filter((r) => !uniqueIds.includes(r.id))
          .map((r) => r.id);

        if (duplicateIds.length > 0) {
          await supabase.from("game_runners").delete().in("id", duplicateIds);
        }
      }

      setRunners(Array.from(uniqueRunners.values()));
    } catch (error) {
      console.error("ランナー取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStealBase = async (
    runnerId: string,
    fromBase: number,
    toBase: number
  ) => {
    try {
      // ランナーの位置を更新
      const { error: updateError } = await supabase
        .from("game_runners")
        .update({
          current_base: toBase,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runnerId);

      if (updateError) throw updateError;

      // 盗塁記録を更新（該当選手の最新打撃記録を更新）
      const runner = runners.find((r) => r.id === runnerId);
      if (runner) {
        const { data: battingRecord } = await supabase
          .from("game_batting_records")
          .select("*")
          .eq("game_id", gameId)
          .eq("player_id", runner.player_id)
          .eq("inning", currentInning)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (battingRecord) {
          const currentStolenBases = battingRecord.stolen_bases_detail || [];
          currentStolenBases.push(toBase);

          await supabase
            .from("game_batting_records")
            .update({
              stolen_base: true,
              stolen_bases_detail: currentStolenBases,
            })
            .eq("id", battingRecord.id);
        }
      }

      await fetchRunners();
      if (onRunnerUpdate) onRunnerUpdate();
    } catch (error) {
      console.error("盗塁記録エラー:", error);
    }
  };

  const handleAdvanceBase = async (
    runnerId: string,
    fromBase: number,
    toBase: number
  ) => {
    try {
      // 目標の塁に既にランナーがいるかチェック
      const targetRunner = getRunnerAtBase(toBase);
      if (targetRunner && toBase < 4) {
        alert(`${toBase === 2 ? "二" : "三"}塁には既にランナーがいます`);
        return;
      }

      // ランナーの位置を更新（盗塁記録なし）
      const { error: updateError } = await supabase
        .from("game_runners")
        .update({
          current_base: toBase,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runnerId);

      if (updateError) throw updateError;

      await fetchRunners();
      if (onRunnerUpdate) onRunnerUpdate();
    } catch (error) {
      console.error("進塁記録エラー:", error);
    }
  };

  const handleScoreRun = async (runnerId: string) => {
    try {
      // ランナーをホーム（得点）に更新
      const { error: updateError } = await supabase
        .from("game_runners")
        .update({
          current_base: 4,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runnerId);

      if (updateError) throw updateError;

      // 得点記録を更新
      const runner = runners.find((r) => r.id === runnerId);
      if (runner) {
        const { error: recordError } = await supabase
          .from("game_batting_records")
          .update({ run_scored: true })
          .eq("game_id", gameId)
          .eq("player_id", runner.player_id)
          .eq("inning", currentInning);

        if (recordError) throw recordError;
      }

      await fetchRunners();
      if (onRunnerUpdate) onRunnerUpdate();
    } catch (error) {
      console.error("得点記録エラー:", error);
    }
  };

  const getRunnerAtBase = (base: number) => {
    return runners.find((r) => r.current_base === base);
  };

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-4">塁上のランナー</h3>

      {/* ダイヤモンド型の塁表示 */}
      <div className="relative w-80 h-80 mx-auto">
        {/* ベースパス（線） */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 320">
          <path
            d="M 160 240 L 80 160 L 160 80 L 240 160 Z"
            stroke="#d1d5db"
            strokeWidth="2"
            fill="none"
          />
        </svg>

        {/* ホームベース */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
          <div className="w-12 h-12 bg-gray-200 border-2 border-gray-400 transform rotate-45 flex items-center justify-center">
            <span className="transform -rotate-45 text-xs font-bold">本</span>
          </div>
        </div>

        {/* 一塁 */}
        <div className="absolute right-0 top-1/2 transform translate-x-0 -translate-y-1/2">
          <div className="w-12 h-12 bg-white border-2 border-gray-400 transform rotate-45 flex items-center justify-center">
            <span className="transform -rotate-45 text-xs font-bold">一</span>
          </div>
          {getRunnerAtBase(1) && (
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap mb-2">
                {getRunnerAtBase(1)?.player_name}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() =>
                    handleAdvanceBase(getRunnerAtBase(1)!.id, 1, 2)
                  }
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                  title="ヒットや野選などによる進塁"
                >
                  進塁→二塁
                </button>
                <button
                  onClick={() => handleStealBase(getRunnerAtBase(1)!.id, 1, 2)}
                  className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                  title="盗塁による進塁"
                >
                  盗塁→二塁
                </button>
                <button
                  onClick={() => handleScoreRun(getRunnerAtBase(1)!.id)}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  title="ホームイン"
                >
                  得点
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 二塁 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
          <div className="w-12 h-12 bg-white border-2 border-gray-400 transform rotate-45 flex items-center justify-center">
            <span className="transform -rotate-45 text-xs font-bold">二</span>
          </div>
          {getRunnerAtBase(2) && (
            <div className="absolute -top-20 left-1/2 transform -translate-x-1/2">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap mb-2">
                {getRunnerAtBase(2)?.player_name}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() =>
                    handleAdvanceBase(getRunnerAtBase(2)!.id, 2, 3)
                  }
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                  title="ヒットや野選などによる進塁"
                >
                  進塁→三塁
                </button>
                <button
                  onClick={() => handleStealBase(getRunnerAtBase(2)!.id, 2, 3)}
                  className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                  title="盗塁による進塁"
                >
                  盗塁→三塁
                </button>
                <button
                  onClick={() => handleScoreRun(getRunnerAtBase(2)!.id)}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  title="ホームイン"
                >
                  得点
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 三塁 */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
          <div className="w-12 h-12 bg-white border-2 border-gray-400 transform rotate-45 flex items-center justify-center">
            <span className="transform -rotate-45 text-xs font-bold">三</span>
          </div>
          {getRunnerAtBase(3) && (
            <div className="absolute -top-16 right-12">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap mb-2">
                {getRunnerAtBase(3)?.player_name}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleScoreRun(getRunnerAtBase(3)!.id)}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  title="ホームイン"
                >
                  得点
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ランナー一覧（リスト形式） */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">現在の塁上</h4>
        {runners.length === 0 ? (
          <p className="text-gray-500 text-sm">ランナーなし</p>
        ) : (
          <ul className="space-y-1">
            {runners
              .sort((a, b) => a.current_base - b.current_base)
              .map((runner) => (
                <li key={runner.id} className="text-sm">
                  <span className="font-medium">{runner.player_name}</span>
                  <span className="text-gray-600 ml-2">
                    {runner.current_base === 1 && "一塁"}
                    {runner.current_base === 2 && "二塁"}
                    {runner.current_base === 3 && "三塁"}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
