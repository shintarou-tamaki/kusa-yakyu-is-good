"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Runner {
  id: string;
  player_id: string;
  player_name: string;
  current_base: number;
}

interface Props {
  gameId: string;
  currentInning: number;
  onDoublePlaySelect: (runnerIds: string[]) => void;
  onCancel: () => void;
}

export default function DoublePlaySelector({
  gameId,
  currentInning,
  onDoublePlaySelect,
  onCancel,
}: Props) {
  const supabase = createClientComponentClient();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [selectedRunners, setSelectedRunners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRunners();
  }, [gameId, currentInning]);

  const fetchRunners = async () => {
    try {
      const { data, error } = await supabase
        .from("game_runners")
        .select("*")
        .eq("game_id", gameId)
        .eq("inning", currentInning)
        .eq("is_active", true)
        .in("current_base", [1, 2, 3])
        .order("current_base", { ascending: true });

      if (error) throw error;
      setRunners(data || []);
    } catch (error) {
      console.error("ランナー取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBaseLabel = (base: number) => {
    switch (base) {
      case 1:
        return "一塁";
      case 2:
        return "二塁";
      case 3:
        return "三塁";
      default:
        return "";
    }
  };

  const handleRunnerToggle = (runnerId: string) => {
    setSelectedRunners((prev) => {
      if (prev.includes(runnerId)) {
        return prev.filter((id) => id !== runnerId);
      } else {
        // 最大2人まで選択可能（打者と合わせて三重殺）
        if (prev.length >= 2) {
          // 既に2人選択されている場合は最初の1人を外して新しいものを追加
          return [...prev.slice(1), runnerId];
        }
        return [...prev, runnerId];
      }
    });
  };

  const handleConfirm = () => {
    if (selectedRunners.length === 0) {
      alert("アウトになるランナーを選択してください");
      return;
    }
    onDoublePlaySelect(selectedRunners);
  };

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }

  if (runners.length === 0) {
    // ランナーがいない場合は通常のアウト
    onDoublePlaySelect([]);
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">併殺プレーの選択</h3>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            打者はアウトになります。追加でアウトになるランナーを選択してください。
          </p>
          <p className="text-xs text-gray-500">
            ※最大2人まで選択可能（トリプルプレーまで対応）
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {runners.map((runner) => (
            <label
              key={runner.id}
              className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedRunners.includes(runner.id)}
                onChange={() => handleRunnerToggle(runner.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-medium">{runner.player_name}</div>
                <div className="text-sm text-gray-500">
                  {getBaseLabel(runner.current_base)}ランナー
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="text-sm text-gray-500 mb-4">
          <p>※併殺が成立しない場合（通常のゴロアウト）は、</p>
          <p>　ランナーを選択せずに「確定」を押してください</p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            確定（
            {selectedRunners.length === 0
              ? "打者のみ"
              : selectedRunners.length === 1
              ? "ダブルプレー"
              : "トリプルプレー"}
            ）
          </button>
        </div>
      </div>
    </div>
  );
}
