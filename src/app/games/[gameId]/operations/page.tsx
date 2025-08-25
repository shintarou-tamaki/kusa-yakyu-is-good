"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeamMember {
  id: string;
  user_id: string;
  user_profiles?: {
    display_name: string | null;
  };
}

interface OperationTask {
  id?: string;
  game_id: string;
  task_type: string;
  person_name: string;
  team_member_id: string | null;
}

interface Game {
  id: string;
  name: string;
  game_date: string;
  home_team_id: string;
}

const TASK_TYPES = [
  { value: "equipment", label: "用具の保管・運搬", icon: "🎒" },
  { value: "scheduling", label: "試合を組む", icon: "📅" },
  { value: "coordination", label: "対戦相手との調整", icon: "🤝" },
  { value: "ground", label: "グラウンドを用意", icon: "🏟️" },
  { value: "attendance", label: "出欠を取る", icon: "📋" },
  { value: "umpire", label: "審判の手配", icon: "⚾" },
  { value: "helper", label: "助っ人の手配", icon: "👥" },
  { value: "media", label: "写真・動画撮影", icon: "📸" },
  { value: "accounting", label: "会計報告", icon: "💰" },
];

interface PageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function GameOperationsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [game, setGame] = useState<Game | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<OperationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<{
    [key: string]: { memberType: "member" | "text"; value: string };
  }>({});
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // 認証状態の読み込み中は何もしない
    if (authLoading) return;

    // 未認証の場合はログインページへ
    if (!user) {
      router.push("/login");
      return;
    }

    // 認証済みの場合のみデータ取得
    fetchData();
  }, [gameId, user, authLoading]);

  const fetchData = async () => {
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

      setGame(gameData);

      // チームメンバーを取得
      const { data: membersData, error: membersError } = await supabase
        .from("team_members")
        .select("id, user_id")
        .eq("team_id", gameData.home_team_id);

      if (membersData) {
        // ユーザープロフィールを取得
        const userIds = membersData.map((m) => m.user_id);
        const { data: profilesData } = await supabase
          .from("user_profiles")
          .select("id, display_name")
          .in("id", userIds);

        const profileMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

        const membersWithProfiles = membersData.map((member) => ({
          ...member,
          user_profiles: profileMap.get(member.user_id) || {
            display_name: null,
          },
        }));

        setTeamMembers(membersWithProfiles);
      }

      // 既存のタスクを取得
      const { data: tasksData, error: tasksError } = await supabase
        .from("game_operation_tasks")
        .select("*")
        .eq("game_id", gameId);

      if (tasksData) {
        setTasks(tasksData);

        // 既存タスクを選択状態に反映
        const selected: {
          [key: string]: { memberType: "member" | "text"; value: string };
        } = {};
        tasksData.forEach((task) => {
          selected[task.task_type] = {
            memberType: task.team_member_id ? "member" : "text",
            value: task.team_member_id || task.person_name,
          };
        });
        setSelectedTasks(selected);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChange = (
    taskType: string,
    memberType: "member" | "text",
    value: string
  ) => {
    setSelectedTasks((prev) => ({
      ...prev,
      [taskType]: { memberType, value },
    }));
  };

  const handleSave = async () => {
    if (!user || !game) return;

    setSaving(true);
    try {
      // 既存のタスクを削除
      const { error: deleteError } = await supabase
        .from("game_operation_tasks")
        .delete()
        .eq("game_id", gameId);

      if (deleteError) {
        console.error("削除エラー:", deleteError);
        alert("保存に失敗しました");
        return;
      }

      // 新しいタスクを挿入
      const newTasks: OperationTask[] = [];

      for (const [taskType, selection] of Object.entries(selectedTasks)) {
        if (selection.value) {
          let personName = "";
          let teamMemberId: string | null = null;

          if (selection.memberType === "member") {
            // メンバーから選択した場合
            teamMemberId = selection.value;
            const member = teamMembers.find((m) => m.id === selection.value);
            personName = member?.user_profiles?.display_name || "名前未設定";
          } else {
            // テキスト入力の場合
            personName = selection.value;
          }

          newTasks.push({
            game_id: gameId,
            task_type: taskType,
            person_name: personName,
            team_member_id: teamMemberId,
          });
        }
      }

      if (newTasks.length > 0) {
        const { error: insertError } = await supabase
          .from("game_operation_tasks")
          .insert(newTasks);

        if (insertError) {
          console.error("挿入エラー:", insertError);
          alert("保存に失敗しました");
          return;
        }
      }

      alert("保存しました！");
      router.push(`/games/${gameId}`);
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
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
        <p className="text-gray-600">試合が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/games/${gameId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
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

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            運営タスク管理
          </h1>
          <p className="text-gray-600">
            {game.name} - {new Date(game.game_date).toLocaleDateString("ja-JP")}
          </p>
        </div>

        {/* 説明文 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            🙏 試合運営にご協力いただいた方々を登録しましょう。
            みんなが野球を楽しめるのは、これらのタスクを担当してくれる方々のおかげです。
          </p>
        </div>

        {/* タスクリスト */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              運営タスク一覧
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {TASK_TYPES.map((task) => {
              const selected = selectedTasks[task.value] || {
                memberType: "member",
                value: "",
              };

              return (
                <div key={task.value} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3 mt-1">{task.icon}</span>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {task.label}
                      </label>
                      <div className="flex items-center space-x-2 mb-2">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name={`${task.value}_type`}
                            value="member"
                            checked={selected.memberType === "member"}
                            onChange={() =>
                              handleTaskChange(task.value, "member", "")
                            }
                            className="form-radio h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            メンバーから選択
                          </span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name={`${task.value}_type`}
                            value="text"
                            checked={selected.memberType === "text"}
                            onChange={() =>
                              handleTaskChange(task.value, "text", "")
                            }
                            className="form-radio h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            名前を入力
                          </span>
                        </label>
                      </div>

                      {selected.memberType === "member" ? (
                        <select
                          value={selected.value}
                          onChange={(e) =>
                            handleTaskChange(
                              task.value,
                              "member",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">選択してください</option>
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.user_profiles?.display_name ||
                                "名前未設定"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={selected.value}
                          onChange={(e) =>
                            handleTaskChange(task.value, "text", e.target.value)
                          }
                          placeholder="担当者の名前を入力"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="mt-6 flex justify-end space-x-4">
          <Link
            href={`/games/${gameId}`}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            キャンセル
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
