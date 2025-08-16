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

const POSITIONS = [
  { value: "投手", label: "投手 (P)" },
  { value: "捕手", label: "捕手 (C)" },
  { value: "一塁手", label: "一塁手 (1B)" },
  { value: "二塁手", label: "二塁手 (2B)" },
  { value: "三塁手", label: "三塁手 (3B)" },
  { value: "遊撃手", label: "遊撃手 (SS)" },
  { value: "左翼手", label: "左翼手 (LF)" },
  { value: "中堅手", label: "中堅手 (CF)" },
  { value: "右翼手", label: "右翼手 (RF)" },
  { value: "指名打者", label: "指名打者 (DH)" },
];

export default function GamePlayersPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [game, setGame] = useState<Game | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [useDH, setUseDH] = useState(false);
  
  // スターティングメンバー用のスロット（1-9番 + DH）
  const [starterSlots, setStarterSlots] = useState<StarterSlot[]>([]);
  
  // 控えメンバー
  const [substitutes, setSubstitutes] = useState<GamePlayer[]>([]);
  const [newSubstituteName, setNewSubstituteName] = useState("");
  const [newSubstituteMemberId, setNewSubstituteMemberId] = useState("");

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (user && gameId) {
      fetchData();
    }
  }, [user, gameId]);

  // 初期スロットを作成
  const initializeSlots = (existingPlayers: GamePlayer[] = []) => {
    const slots: StarterSlot[] = [];
    const maxOrder = useDH ? 10 : 9;
    
    for (let i = 1; i <= maxOrder; i++) {
      const existing = existingPlayers.find(p => p.batting_order === i && p.is_starter);
      if (existing) {
        slots.push({
          batting_order: i,
          player_name: existing.player_name,
          team_member_id: existing.team_member_id || "",
          position: existing.position || "",
          existing_id: existing.id
        });
      } else {
        slots.push({
          batting_order: i,
          player_name: "",
          team_member_id: "",
          position: i === 10 ? "指名打者" : ""
        });
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
          const userIds = membersData.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, display_name")
            .in("id", userIds);

          const membersWithProfiles = membersData.map(member => ({
            ...member,
            user_profiles: profiles?.find(p => p.id === member.user_id) || null
          }));

          setTeamMembers(membersWithProfiles);
        }
      }

      // 既存の試合参加メンバーを取得
      const { data: playersData } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .eq("is_active", true);

      if (playersData) {
        // DHが含まれているかチェック
        const hasDH = playersData.some(p => p.batting_order === 10 || p.position === "指名打者");
        setUseDH(hasDH);
        
        // スターティングメンバーのスロットを初期化
        initializeSlots(playersData);
        
        // 控えメンバーをセット
        const subs = playersData.filter(p => !p.is_starter);
        setSubstitutes(subs);
      } else {
        // 新規の場合は空のスロットを初期化
        initializeSlots();
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
  const getSelectedMemberIds = (excludeIndex?: number) => {
    return starterSlots
      .filter((_, i) => i !== excludeIndex)
      .map(s => s.team_member_id)
      .filter(id => id !== "");
  };

  // 既に選択されている守備位置のリストを取得
  const getSelectedPositions = (excludeIndex?: number) => {
    return starterSlots
      .filter((_, i) => i !== excludeIndex)
      .map(s => s.position)
      .filter(pos => pos !== "");
  };

  // スロットの更新
  const updateSlot = (index: number, field: keyof StarterSlot, value: string) => {
    const newSlots = [...starterSlots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    
    // チームメンバーを選択した場合、名前を自動設定
    if (field === "team_member_id" && value) {
      const member = teamMembers.find(m => m.id === value);
      if (member) {
        newSlots[index].player_name = member.user_profiles?.display_name || "名前未設定";
      }
    }
    // 名前を直接入力した場合、メンバーIDをクリア
    else if (field === "player_name") {
      newSlots[index].team_member_id = "";
    }
    
    setStarterSlots(newSlots);
  };

  // DHの切り替え
  const toggleDH = () => {
    const newUseDH = !useDH;
    setUseDH(newUseDH);
    
    if (newUseDH) {
      // DH枠を追加
      setStarterSlots([...starterSlots, {
        batting_order: 10,
        player_name: "",
        team_member_id: "",
        position: "指名打者"
      }]);
    } else {
      // DH枠を削除
      setStarterSlots(starterSlots.filter(s => s.batting_order !== 10));
    }
  };

  // 保存処理
  const handleSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      // 既存のプレイヤーを削除
      const { error: deleteError } = await supabase
        .from("game_players")
        .delete()
        .eq("game_id", gameId);

      if (deleteError) {
        console.error("削除エラー:", deleteError);
        setError("保存に失敗しました");
        return;
      }

      // 保存するプレイヤーのリストを作成
      const playersToSave: Omit<GamePlayer, "id">[] = [];

      // スターティングメンバーを追加
      for (const slot of starterSlots) {
        if (slot.player_name.trim()) {
          playersToSave.push({
            game_id: gameId,
            player_name: slot.player_name.trim(),
            team_member_id: slot.team_member_id || null,
            is_starter: true,
            batting_order: slot.batting_order,
            position: slot.position || null,
            is_active: true
          });
        }
      }

      // 控えメンバーを追加
      for (const sub of substitutes) {
        playersToSave.push({
          game_id: gameId,
          player_name: sub.player_name,
          team_member_id: sub.team_member_id,
          is_starter: false,
          batting_order: null,
          position: null,
          is_active: true
        });
      }

      // 一括挿入
      if (playersToSave.length > 0) {
        const { error: insertError } = await supabase
          .from("game_players")
          .insert(playersToSave);

        if (insertError) {
          console.error("挿入エラー:", insertError);
          setError("保存に失敗しました");
          return;
        }
      }

      setMessage("保存しました");
      setTimeout(() => setMessage(""), 3000);
      
      // データを再取得
      await fetchData();
    } catch (error) {
      console.error("エラー:", error);
      setError("予期しないエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // 控えメンバー追加
  const handleAddSubstitute = () => {
    if (!newSubstituteName.trim() && !newSubstituteMemberId) {
      setError("控えメンバーの名前を入力するか、メンバーを選択してください");
      return;
    }

    let playerName = newSubstituteName.trim();
    if (newSubstituteMemberId) {
      const member = teamMembers.find(m => m.id === newSubstituteMemberId);
      playerName = member?.user_profiles?.display_name || "名前未設定";
    }

    const newSub: GamePlayer = {
      game_id: gameId,
      player_name: playerName,
      team_member_id: newSubstituteMemberId || null,
      is_starter: false,
      batting_order: null,
      position: null,
      is_active: true
    };

    setSubstitutes([...substitutes, newSub]);
    setNewSubstituteName("");
    setNewSubstituteMemberId("");
    setError("");
  };

  // 既に選択されている全てのチームメンバーIDを取得（控えメンバー用）
  const getAllSelectedMemberIds = () => {
    const starterIds = starterSlots
      .map(s => s.team_member_id)
      .filter(id => id !== "");
    const substituteIds = substitutes
      .map(s => s.team_member_id)
      .filter(id => id !== null && id !== "") as string[];
    return [...starterIds, ...substituteIds];
  };

  // 控えメンバー削除
  const handleRemoveSubstitute = (index: number) => {
    setSubstitutes(substitutes.filter((_, i) => i !== index));
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
        <div className="text-center">
          <p className="text-gray-600 mb-4">試合が見つかりません</p>
          <Link href="/games" className="text-blue-600 hover:text-blue-700">
            試合一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/games/${gameId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            試合詳細に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{game.name}</h1>
                <p className="text-gray-600 mt-1">試合参加メンバー管理</p>
              </div>
              {canEdit && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {message && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600">{message}</p>
            </div>
          )}

          {canEdit ? (
            <>
              {/* スターティングメンバー編集 */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">スターティングメンバー</h2>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={useDH}
                      onChange={toggleDH}
                      className="mr-2"
                    />
                    <span className="text-sm">DH制を使用</span>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">打順</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">選手名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">チームメンバー</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">守備位置</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {starterSlots.map((slot, index) => (
                        <tr key={slot.batting_order}>
                          <td className="px-4 py-4 whitespace-nowrap font-medium">
                            {slot.batting_order}番
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={slot.player_name}
                              onChange={(e) => updateSlot(index, "player_name", e.target.value)}
                              disabled={slot.team_member_id !== ""}
                              placeholder="名前を入力"
                              className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <select
                              value={slot.team_member_id}
                              onChange={(e) => updateSlot(index, "team_member_id", e.target.value)}
                              className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option:disabled]:bg-gray-100 [&>option:disabled]:text-gray-400"
                            >
                              <option value="">チームメンバーから選択</option>
                              {teamMembers.map((member) => {
                                const selectedMemberIds = getSelectedMemberIds(index);
                                const isDisabled = selectedMemberIds.includes(member.id);
                                return (
                                  <option 
                                    key={member.id} 
                                    value={member.id}
                                    disabled={isDisabled}
                                  >
                                    {member.user_profiles?.display_name || "名前未設定"}
                                    {isDisabled ? " (選択済み)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <select
                              value={slot.position}
                              onChange={(e) => updateSlot(index, "position", e.target.value)}
                              className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option:disabled]:bg-gray-100 [&>option:disabled]:text-gray-400"
                            >
                              <option value="">-</option>
                              {POSITIONS.map((pos) => {
                                const selectedPositions = getSelectedPositions(index);
                                const isDisabled = selectedPositions.includes(pos.value);
                                return (
                                  <option 
                                    key={pos.value} 
                                    value={pos.value}
                                    disabled={isDisabled}
                                  >
                                    {pos.label}
                                    {isDisabled ? " (選択済み)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 控えメンバー編集 */}
              <div className="p-6 border-t">
                <h2 className="text-lg font-semibold mb-4">控えメンバー</h2>
                
                {/* 控えメンバー追加フォーム */}
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newSubstituteName}
                    onChange={(e) => {
                      setNewSubstituteName(e.target.value);
                      setNewSubstituteMemberId("");
                    }}
                    disabled={newSubstituteMemberId !== ""}
                    placeholder="名前を入力"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option:disabled]:bg-gray-100 [&>option:disabled]:text-gray-400"
                  />
                  <select
                    value={newSubstituteMemberId}
                    onChange={(e) => {
                      setNewSubstituteMemberId(e.target.value);
                      setNewSubstituteName("");
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">チームメンバーから選択</option>
                    {teamMembers.map((member) => {
                      const allSelectedIds = getAllSelectedMemberIds();
                      const isDisabled = allSelectedIds.includes(member.id);
                      return (
                        <option 
                          key={member.id} 
                          value={member.id}
                          disabled={isDisabled}
                        >
                          {member.user_profiles?.display_name || "名前未設定"}
                          {isDisabled ? " (選択済み)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={handleAddSubstitute}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    追加
                  </button>
                </div>

                {/* 控えメンバーリスト */}
                {substitutes.length === 0 ? (
                  <p className="text-gray-500">控えメンバーは登録されていません</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {substitutes.map((sub, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="font-medium">{sub.player_name}</span>
                        <button
                          onClick={() => handleRemoveSubstitute(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 保存ボタン（下部にも配置） */}
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </>
          ) : (
            /* 閲覧モード */
            <>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">
                  スターティングメンバー
                </h2>
                {starterSlots.filter(s => s.player_name).length === 0 ? (
                  <p className="text-gray-500">まだメンバーが登録されていません</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {starterSlots.filter(s => s.player_name).map((slot) => (
                      <div key={slot.batting_order} className="flex items-center text-sm">
                        <span className="font-medium mr-2">{slot.batting_order}.</span>
                        <span className="flex-1">{slot.player_name}</span>
                        {slot.position && (
                          <span className="text-gray-500 ml-2">({slot.position})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {substitutes.length > 0 && (
                <div className="p-6 border-t">
                  <h2 className="text-lg font-semibold mb-4">控えメンバー</h2>
                  <div className="flex flex-wrap gap-2">
                    {substitutes.map((sub) => (
                      <span key={sub.id} className="text-sm text-gray-700">
                        {sub.player_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}