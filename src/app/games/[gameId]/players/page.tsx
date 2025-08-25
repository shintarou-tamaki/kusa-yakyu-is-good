"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    gameId: string;
  }>;
}

interface Game {
  id: string;
  name: string;
  game_date: string;
  home_team_id: string | null;
  opponent_name: string;
  created_by: string;
  status: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  user_profiles?: {
    display_name: string;
  };
}

interface GamePlayer {
  id?: string;
  game_id: string;
  player_name: string;
  team_member_id: string | null;
  is_starter: boolean;
  batting_order: number | null;
  position: string | null;
  is_active: boolean;
}

interface StarterSlot {
  batting_order: number;
  player_name: string;
  team_member_id: string;
  position: string;
  existing_id?: string;
}

interface DefaultLineupPlayer {
  id?: string;
  team_id: string;
  player_name: string;
  team_member_id: string | null;
  batting_order: number | null;
  position: string | null;
  is_starter: boolean;
}

const POSITIONS = [
  { value: "投手", label: "投手" },
  { value: "捕手", label: "捕手" },
  { value: "一塁手", label: "一塁手" },
  { value: "二塁手", label: "二塁手" },
  { value: "三塁手", label: "三塁手" },
  { value: "遊撃手", label: "遊撃手" },
  { value: "左翼手", label: "左翼手" },
  { value: "中堅手", label: "中堅手" },
  { value: "右翼手", label: "右翼手" },
  { value: "指名打者", label: "指名打者" },
];

export default function MemberManagementPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClientComponentClient();

  const [game, setGame] = useState<Game | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [starterSlots, setStarterSlots] = useState<StarterSlot[]>([]);
  const [substitutes, setSubstitutes] = useState<GamePlayer[]>([]);
  const [newSubstitute, setNewSubstitute] = useState({
    name: "",
    teamMemberId: "",
  });
  const [useDH, setUseDH] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hasExistingData, setHasExistingData] = useState(false);

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

  // スロットの初期化（デフォルトラインナップまたは既存データから）
  const initializeSlots = (
    existingPlayers: GamePlayer[] = [],
    defaultLineup: DefaultLineupPlayer[] = []
  ) => {
    const slots: StarterSlot[] = [];
    const maxOrder = useDH ? 10 : 9;

    for (let i = 1; i <= maxOrder; i++) {
      // まず既存のgame_playersデータを確認
      const existing = existingPlayers.find(
        (p) => p.batting_order === i && p.is_starter
      );
      if (existing) {
        slots.push({
          batting_order: i,
          player_name: existing.player_name,
          team_member_id: existing.team_member_id || "",
          position: existing.position || "",
          existing_id: existing.id,
        });
      } else {
        // 既存データがない場合はデフォルトラインナップから取得
        const defaultPlayer = defaultLineup.find(
          (p) => p.batting_order === i && p.is_starter
        );
        if (defaultPlayer) {
          slots.push({
            batting_order: i,
            player_name: defaultPlayer.player_name,
            team_member_id: defaultPlayer.team_member_id || "",
            position: defaultPlayer.position || "",
          });
        } else {
          // どちらもない場合は空のスロット
          slots.push({
            batting_order: i,
            player_name: "",
            team_member_id: "",
            position: i === 10 ? "指名打者" : "",
          });
        }
      }
    }
    setStarterSlots(slots);
  };

  const fetchData = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        setError("試合情報の取得に失敗しました");
        return;
      }

      setGame(gameData);

      // 編集権限チェック
      const isOwner = gameData.created_by === user?.id;
      const isTeamOwner = await checkTeamOwnership(gameData.home_team_id);
      setCanEdit(isOwner || isTeamOwner);

      // チームメンバーを取得
      if (gameData.home_team_id) {
        const { data: membersData } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", gameData.home_team_id);

        if (membersData) {
          // ユーザープロフィールを取得
          const userIds = membersData.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, display_name")
            .in("id", userIds);

          const membersWithProfiles = membersData.map((member) => ({
            ...member,
            user_profiles:
              profiles?.find((p) => p.id === member.user_id) || null,
          }));

          setTeamMembers(membersWithProfiles);
        }

        // デフォルトラインナップを取得
        const { data: defaultLineupData } = await supabase
          .from("team_default_lineup")
          .select("*")
          .eq("team_id", gameData.home_team_id);

        // 既存の試合参加メンバーを取得
        const { data: playersData } = await supabase
          .from("game_players")
          .select("*")
          .eq("game_id", gameId)
          .eq("is_active", true);

        if (playersData && playersData.length > 0) {
          // 既存データがある場合
          setHasExistingData(true);
          const hasDH = playersData.some(
            (p) => p.batting_order === 10 || p.position === "指名打者"
          );
          setUseDH(hasDH);

          // 既存データで初期化
          initializeSlots(playersData, []);

          // 控えメンバーをセット
          const subs = playersData.filter((p) => !p.is_starter);
          setSubstitutes(subs);
        } else if (defaultLineupData && defaultLineupData.length > 0) {
          // 既存データがなく、デフォルトラインナップがある場合
          const hasDH = defaultLineupData.some(
            (p) => p.batting_order === 10 || p.position === "指名打者"
          );
          setUseDH(hasDH);

          // デフォルトラインナップで初期化
          initializeSlots([], defaultLineupData);

          // デフォルトの控えメンバーもセット
          const defaultSubs = defaultLineupData
            .filter((p) => !p.is_starter)
            .map((p) => ({
              game_id: gameId,
              player_name: p.player_name,
              team_member_id: p.team_member_id,
              is_starter: false,
              batting_order: null,
              position: null,
              is_active: true,
            }));
          setSubstitutes(defaultSubs);
        } else {
          // どちらもない場合は空のスロットを初期化
          initializeSlots();
        }
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const checkTeamOwnership = async (teamId: string | null) => {
    if (!teamId || !user) return false;

    const { data } = await supabase
      .from("teams")
      .select("owner_id")
      .eq("id", teamId)
      .single();

    return data?.owner_id === user.id;
  };

  // 既に選択されているチームメンバーIDのリストを取得
  const getSelectedMemberIds = (excludeIndex?: number): string[] => {
    const ids: string[] = [];

    // スターティングメンバーから
    starterSlots.forEach((slot, index) => {
      if (slot.team_member_id && index !== excludeIndex) {
        ids.push(slot.team_member_id);
      }
    });

    // 控えメンバーから
    substitutes.forEach((sub) => {
      if (sub.team_member_id) {
        ids.push(sub.team_member_id);
      }
    });

    return ids;
  };

  // 既に選択されている守備位置のリストを取得
  const getSelectedPositions = (excludeIndex?: number): string[] => {
    const positions: string[] = [];

    starterSlots.forEach((slot, index) => {
      if (
        slot.position &&
        index !== excludeIndex &&
        slot.position !== "指名打者"
      ) {
        positions.push(slot.position);
      }
    });

    return positions;
  };

  const updateSlot = (
    index: number,
    field: keyof StarterSlot,
    value: string
  ) => {
    const newSlots = [...starterSlots];

    if (field === "team_member_id") {
      if (value) {
        const member = teamMembers.find((m) => m.id === value);
        if (member) {
          newSlots[index] = {
            ...newSlots[index],
            team_member_id: value,
            player_name: member.user_profiles?.display_name || "名前未設定",
          };
        }
      } else {
        newSlots[index] = {
          ...newSlots[index],
          team_member_id: "",
          player_name: "",
        };
      }
    } else if (field === "player_name") {
      newSlots[index] = {
        ...newSlots[index],
        player_name: value,
        team_member_id: "",
      };
    } else {
      newSlots[index] = {
        ...newSlots[index],
        [field]: value,
      };
    }

    setStarterSlots(newSlots);
  };

  const handleDHToggle = () => {
    if (!useDH) {
      // DH追加
      setUseDH(true);
      setStarterSlots([
        ...starterSlots,
        {
          batting_order: 10,
          player_name: "",
          team_member_id: "",
          position: "指名打者",
        },
      ]);
    } else {
      // DH削除
      setUseDH(false);
      setStarterSlots(starterSlots.filter((s) => s.batting_order !== 10));
    }
  };

  const addSubstitute = () => {
    if (!newSubstitute.name && !newSubstitute.teamMemberId) {
      alert("控えメンバーの名前を入力してください");
      return;
    }

    let playerName = "";
    let teamMemberId: string | null = null;

    if (newSubstitute.teamMemberId) {
      const member = teamMembers.find(
        (m) => m.id === newSubstitute.teamMemberId
      );
      if (member) {
        playerName = member.user_profiles?.display_name || "名前未設定";
        teamMemberId = member.id;
      }
    } else {
      playerName = newSubstitute.name;
    }

    const newSub: GamePlayer = {
      game_id: gameId,
      player_name: playerName,
      team_member_id: teamMemberId,
      is_starter: false,
      batting_order: null,
      position: null,
      is_active: true,
    };

    setSubstitutes([...substitutes, newSub]);
    setNewSubstitute({ name: "", teamMemberId: "" });
  };

  const removeSubstitute = (index: number) => {
    setSubstitutes(substitutes.filter((_, i) => i !== index));
  };

  const saveLineup = async () => {
    if (!game?.home_team_id) {
      alert("チーム情報がありません");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // 既存のgame_playersを削除
      await supabase.from("game_players").delete().eq("game_id", gameId);

      // 新しいgame_playersデータを作成
      const playersToInsert: any[] = [];

      // スターティングメンバー
      starterSlots.forEach((slot) => {
        if (slot.player_name) {
          playersToInsert.push({
            game_id: gameId,
            player_name: slot.player_name,
            team_member_id: slot.team_member_id || null,
            is_starter: true,
            batting_order: slot.batting_order,
            position: slot.position || null,
            is_active: true,
          });
        }
      });

      // 控えメンバー
      substitutes.forEach((sub) => {
        playersToInsert.push({
          game_id: gameId,
          player_name: sub.player_name,
          team_member_id: sub.team_member_id || null,
          is_starter: false,
          batting_order: null,
          position: null,
          is_active: true,
        });
      });

      if (playersToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("game_players")
          .insert(playersToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      // デフォルトラインナップも更新
      // 既存のデフォルトラインナップを削除
      await supabase
        .from("team_default_lineup")
        .delete()
        .eq("team_id", game.home_team_id);

      // 新しいデフォルトラインナップを保存
      const defaultLineupToInsert: any[] = [];

      // スターティングメンバーをデフォルトとして保存
      starterSlots.forEach((slot) => {
        if (slot.player_name) {
          defaultLineupToInsert.push({
            team_id: game.home_team_id,
            player_name: slot.player_name,
            team_member_id: slot.team_member_id || null,
            batting_order: slot.batting_order,
            position: slot.position || null,
            is_starter: true,
          });
        }
      });

      // 控えメンバーもデフォルトとして保存
      substitutes.forEach((sub) => {
        defaultLineupToInsert.push({
          team_id: game.home_team_id,
          player_name: sub.player_name,
          team_member_id: sub.team_member_id || null,
          batting_order: null,
          position: null,
          is_starter: false,
        });
      });

      if (defaultLineupToInsert.length > 0) {
        const { error: defaultError } = await supabase
          .from("team_default_lineup")
          .insert(defaultLineupToInsert);

        if (defaultError) {
          console.error("デフォルトラインナップ保存エラー:", defaultError);
          // エラーが発生してもgame_playersは保存されているので続行
        }
      }

      alert("メンバー設定を保存しました");
      router.push(`/games/${gameId}`);
    } catch (error) {
      console.error("保存エラー:", error);
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">試合情報が見つかりません</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href={`/games/${gameId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
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
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900">メンバー管理</h1>
            <p className="mt-2 text-gray-600">
              {game.name} -{" "}
              {new Date(game.game_date).toLocaleDateString("ja-JP")}
            </p>
            {!hasExistingData && (
              <p className="mt-2 text-sm text-blue-600">
                ※ 前回の設定内容をデフォルトとして読み込んでいます
              </p>
            )}
          </div>

          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          <div className="p-6">
            {/* DH制度の切り替え */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={useDH}
                  onChange={handleDHToggle}
                  disabled={!canEdit}
                  className="mr-2"
                />
                <span className="text-gray-700">DH（指名打者）制を使用</span>
              </label>
            </div>

            {/* スターティングメンバー */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                スターティングメンバー
              </h2>
              <div className="space-y-3">
                {starterSlots.map((slot, index) => {
                  const selectedIds = getSelectedMemberIds(index);
                  const availableMembers = teamMembers.filter(
                    (m) => !selectedIds.includes(m.id)
                  );

                  return (
                    <div
                      key={slot.batting_order}
                      className="flex gap-4 items-center"
                    >
                      <span className="w-8 text-gray-600 font-medium">
                        {slot.batting_order}.
                      </span>

                      <div className="flex-1 flex gap-2">
                        <select
                          value={slot.team_member_id}
                          onChange={(e) =>
                            updateSlot(index, "team_member_id", e.target.value)
                          }
                          disabled={!canEdit}
                          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">チームメンバーから選択</option>
                          {slot.team_member_id && (
                            <option value={slot.team_member_id}>
                              {teamMembers.find(
                                (m) => m.id === slot.team_member_id
                              )?.user_profiles?.display_name || "名前未設定"}
                            </option>
                          )}
                          {availableMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.user_profiles?.display_name ||
                                "名前未設定"}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={slot.team_member_id ? "" : slot.player_name}
                          onChange={(e) =>
                            updateSlot(index, "player_name", e.target.value)
                          }
                          placeholder="または直接入力"
                          disabled={!canEdit || !!slot.team_member_id}
                          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <select
                        value={slot.position}
                        onChange={(e) =>
                          updateSlot(index, "position", e.target.value)
                        }
                        disabled={!canEdit}
                        className="w-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">守備位置</option>
                        {POSITIONS.map((pos) => {
                          const isSelected = getSelectedPositions(
                            index
                          ).includes(pos.value);
                          const isDisabled =
                            isSelected && pos.value !== "指名打者";

                          return (
                            <option
                              key={pos.value}
                              value={pos.value}
                              disabled={isDisabled}
                            >
                              {pos.label}
                              {isDisabled ? " (選択済)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 控えメンバー */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                控えメンバー
              </h2>

              {/* 控えメンバーリスト */}
              {substitutes.length > 0 && (
                <div className="mb-4 space-y-2">
                  {substitutes.map((sub, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 bg-gray-50 rounded"
                    >
                      <span className="flex-1">{sub.player_name}</span>
                      {canEdit && (
                        <button
                          onClick={() => removeSubstitute(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 控えメンバー追加 */}
              {canEdit && (
                <div className="flex gap-2">
                  <select
                    value={newSubstitute.teamMemberId}
                    onChange={(e) =>
                      setNewSubstitute({
                        ...newSubstitute,
                        teamMemberId: e.target.value,
                        name: "",
                      })
                    }
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">チームメンバーから選択</option>
                    {teamMembers
                      .filter((m) => !getSelectedMemberIds().includes(m.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user_profiles?.display_name || "名前未設定"}
                        </option>
                      ))}
                  </select>

                  <input
                    type="text"
                    value={newSubstitute.teamMemberId ? "" : newSubstitute.name}
                    onChange={(e) =>
                      setNewSubstitute({
                        ...newSubstitute,
                        name: e.target.value,
                        teamMemberId: "",
                      })
                    }
                    placeholder="または直接入力"
                    disabled={!!newSubstitute.teamMemberId}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />

                  <button
                    onClick={addSubstitute}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    追加
                  </button>
                </div>
              )}
            </div>

            {/* 保存ボタン */}
            {canEdit && (
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => router.push(`/games/${gameId}`)}
                  disabled={saving}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveLineup}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
