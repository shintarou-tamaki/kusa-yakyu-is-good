"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface TaskStat {
  person_name: string;
  task_type: string;
  count: number;
}

interface PersonStat {
  person_name: string;
  total_tasks: number;
  tasks_breakdown: {
    task_type: string;
    count: number;
  }[];
}

interface TeamOperationStatsProps {
  teamId: string;
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

export default function TeamOperationStats({
  teamId,
}: TeamOperationStatsProps) {
  const [personStats, setPersonStats] = useState<PersonStat[]>([]);
  const [taskStats, setTaskStats] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear()); // 現在の年を取得
  const [totalGames, setTotalGames] = useState(0);
  const [activeView, setActiveView] = useState<"person" | "task">("person");
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (teamId) {
      fetchOperationStats();
    }
  }, [teamId]);

  const fetchOperationStats = async () => {
    try {
      // その年のチームの試合を取得
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("id")
        .eq("home_team_id", teamId)
        .gte("game_date", startOfYear)
        .lte("game_date", endOfYear);

      if (gamesError) {
        console.error("試合取得エラー:", gamesError);
        setLoading(false);
        return;
      }

      if (!gamesData || gamesData.length === 0) {
        setLoading(false);
        return;
      }

      setTotalGames(gamesData.length);
      const gameIds = gamesData.map((g) => g.id);

      // これらの試合の運営タスクを取得
      const { data: tasksData, error: tasksError } = await supabase
        .from("game_operation_tasks")
        .select("*")
        .in("game_id", gameIds);

      if (tasksError) {
        console.error("タスク取得エラー:", tasksError);
        setLoading(false);
        return;
      }

      if (!tasksData || tasksData.length === 0) {
        setLoading(false);
        return;
      }

      // 人ごとに集計
      const personMap = new Map<
        string,
        {
          total: number;
          tasks: Map<string, number>;
        }
      >();

      // タスクごとの集計
      const taskCount: { [key: string]: number } = {};

      tasksData.forEach((task) => {
        // 人ごとの集計
        const existing = personMap.get(task.person_name) || {
          total: 0,
          tasks: new Map<string, number>(),
        };
        existing.total++;
        existing.tasks.set(
          task.task_type,
          (existing.tasks.get(task.task_type) || 0) + 1
        );
        personMap.set(task.person_name, existing);

        // タスクごとの集計
        taskCount[task.task_type] = (taskCount[task.task_type] || 0) + 1;
      });

      // PersonStatの配列に変換
      const stats: PersonStat[] = Array.from(personMap.entries()).map(
        ([name, data]) => ({
          person_name: name,
          total_tasks: data.total,
          tasks_breakdown: Array.from(data.tasks.entries())
            .map(([type, count]) => ({
              task_type: type,
              count: count,
            }))
            .sort((a, b) => b.count - a.count),
        })
      );

      // 貢献度順にソート
      stats.sort((a, b) => b.total_tasks - a.total_tasks);

      setPersonStats(stats);
      setTaskStats(taskCount);
    } catch (error) {
      console.error("集計エラー:", error);
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

  if (personStats.length === 0) {
    return null; // データがない場合は表示しない
  }

  // トップ貢献者を取得（最大3名）
  const topContributors = personStats.slice(0, 3);

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-lg border border-orange-200">
      <div className="px-6 py-4 border-b border-orange-200 bg-white bg-opacity-70 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="text-2xl mr-2">🏆</span>
            {year}年 チーム運営への貢献
          </h3>
          <span className="text-sm text-gray-600">
            {totalGames}試合分の集計
          </span>
        </div>
      </div>

      {/* 感謝のメッセージ */}
      <div className="text-center mt-6 p-4 bg-white bg-opacity-80 rounded-lg">
        <p className="text-lg font-bold text-orange-800">
          ✨ チーム運営にご協力いただき、本当にありがとうございます！ ✨
        </p>
      </div>

      <div className="p-6">
        {activeView === "person" ? (
          <>
            {/* MVP表彰 */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topContributors.map((person, index) => {
                  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                  const bgColor =
                    index === 0
                      ? "bg-yellow-100"
                      : index === 1
                      ? "bg-gray-100"
                      : "bg-orange-100";

                  return (
                    <div
                      key={person.person_name}
                      className={`${bgColor} rounded-lg p-4 text-center shadow-sm`}
                    >
                      <div className="text-3xl mb-2">{medal}</div>
                      <h4 className="font-bold text-gray-900 text-lg mb-1">
                        {person.person_name}
                      </h4>
                      <p className="text-2xl font-bold text-gray-800 mb-2">
                        {person.total_tasks}回
                      </p>
                      <div className="text-xs text-gray-600 space-y-1">
                        {person.tasks_breakdown.slice(0, 2).map((task) => {
                          const taskInfo = TASK_LABELS[task.task_type];
                          return (
                            <div key={task.task_type}>
                              {taskInfo?.icon} {taskInfo?.label}: {task.count}回
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 全貢献者リスト */}
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">全貢献者一覧</h4>
              <div className="space-y-3">
                {personStats.map((person, index) => (
                  <div
                    key={person.person_name}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <span className="text-lg font-semibold text-gray-500 w-8">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900 ml-3">
                        {person.person_name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-xl font-bold text-orange-600">
                          {person.total_tasks}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">回</span>
                      </div>
                      <details className="cursor-pointer">
                        <summary className="text-sm text-blue-600 hover:text-blue-700">
                          詳細
                        </summary>
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg p-3 z-10">
                          <div className="space-y-1">
                            {person.tasks_breakdown.map((task) => {
                              const taskInfo = TASK_LABELS[task.task_type];
                              return (
                                <div
                                  key={task.task_type}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-gray-600">
                                    {taskInfo?.icon} {taskInfo?.label}
                                  </span>
                                  <span className="font-medium">
                                    {task.count}回
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* タスク別集計ビュー */
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">
              タスク別実施回数
            </h4>
            <div className="space-y-4">
              {Object.entries(TASK_LABELS).map(([taskType, taskInfo]) => {
                const count = taskStats[taskType] || 0;
                const percentage =
                  totalGames > 0 ? Math.round((count / totalGames) * 100) : 0;

                return (
                  <div key={taskType} className="border-b pb-3 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{taskInfo.icon}</span>
                        <span className="font-medium text-gray-900">
                          {taskInfo.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-800">
                          {count}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">
                          / {totalGames}試合
                        </span>
                      </div>
                    </div>
                    <div className="ml-11">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {percentage}%の試合で実施
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
