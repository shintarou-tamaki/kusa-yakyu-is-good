"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface OperationTask {
  id: string;
  game_id: string;
  task_type: string;
  person_name: string;
  team_member_id: string | null;
}

interface OperationTasksDisplayProps {
  gameId: string;
}

const TASK_LABELS: { [key: string]: { label: string; icon: string } } = {
  equipment: { label: "用具の保管・運搬", icon: "🎒" },
  scheduling: { label: "試合を組む", icon: "📅" },
  coordination: { label: "対戦相手との調整", icon: "🤝" },
  ground: { label: "グラウンドを用意", icon: "🏟️" },
  attendance: { label: "出欠を取る", icon: "📋" },
  umpire: { label: "審判の手配", icon: "⚾" },
  helper: { label: "助っ人の手配", icon: "👥" },
  media: { label: "写真・動画撮影", icon: "📸" },
  accounting: { label: "会計報告", icon: "💰" },
};

export default function OperationTasksDisplay({
  gameId,
}: OperationTasksDisplayProps) {
  const [tasks, setTasks] = useState<OperationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (gameId) {
      fetchTasks();
    }
  }, [gameId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("game_operation_tasks")
        .select("*")
        .eq("game_id", gameId);

      if (error) {
        console.error("運営タスク取得エラー:", error);
      } else if (data) {
        setTasks(data);
      }
    } catch (error) {
      console.error("エラー:", error);
    } finally {
      setLoading(false);
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

  if (tasks.length === 0) {
    return null; // タスクが登録されていない場合は何も表示しない
  }

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-lg border border-orange-200">
      <div className="px-6 py-4 border-b border-orange-200 bg-white bg-opacity-70 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="text-2xl mr-2">🙏</span>
          この試合を支えてくれた方々
        </h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {tasks.map((task) => {
            const taskInfo = TASK_LABELS[task.task_type];
            if (!taskInfo) return null;

            return (
              <div
                key={task.id}
                className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start">
                  <span className="text-2xl mr-3">{taskInfo.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">
                      {taskInfo.label}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {task.person_name}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-6 p-4 bg-white bg-opacity-60 rounded-lg">
          <p className="text-lg font-bold text-orange-800">
            ✨ ありがとうございます！ ✨
          </p>
          <p className="text-sm text-gray-700 mt-2">
            みんなが野球を楽しめるのは、あなたたちのおかげです
          </p>
        </div>
      </div>
    </div>
  );
}
