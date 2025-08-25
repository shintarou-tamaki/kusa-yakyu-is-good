"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface GamePlayer {
  id: string;
  game_id: string;
  player_name: string;
  team_member_id: string | null;
  is_starter: boolean;
  batting_order: number | null;
  position: string | null;
  is_active: boolean;
}

interface Substitution {
  id?: string;
  game_id: string;
  inning: number;
  out_player_id: string;
  in_player_id: string;
  substitution_type: string;
  batting_order: number | null;
  new_position: string | null;
  description: string;
}

interface Props {
  gameId: string;
  currentInning: number;
  canEdit: boolean;
  onSubstitutionComplete?: () => void;
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
  { value: "指名打者", label: "DH" }
];

export default function PlayerSubstitution({
  gameId,
  currentInning,
  canEdit,
  onSubstitutionComplete
}: Props) {
  const supabase = createClientComponentClient();
  
  const [activePlayers, setActivePlayers] = useState<GamePlayer[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<GamePlayer[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [selectedOutPlayer, setSelectedOutPlayer] = useState<string>("");
  const [selectedInPlayer, setSelectedInPlayer] = useState<string>("");
  const [newPosition, setNewPosition] = useState<string>("");
  const [substitutionType, setSubstitutionType] = useState<string>("player_change");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // 選手データの取得
  useEffect(() => {
    fetchPlayers();
    fetchSubstitutions();
  }, [gameId]);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId);

      if (error) {
        console.error("選手取得エラー:", error);
        return;
      }

      if (data) {
        // 出場中の選手と控え選手を分ける
        const active = data.filter(p => p.is_active);
        const bench = data.filter(p => !p.is_active && !p.is_starter);
        
        setActivePlayers(active.sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99)));
        setBenchPlayers(bench);
      }
    } catch (error) {
      console.error("エラー:", error);
    }
  };

  const fetchSubstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from("game_substitutions")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false });

      if (data) {
        setSubstitutions(data);
      }
    } catch (error) {
      console.error("交代履歴取得エラー:", error);
    }
  };

  // 選手交代の実行
  const handleSubstitution = async () => {
    if (!selectedOutPlayer || !selectedInPlayer || !canEdit) return;

    setSaving(true);
    setMessage("");

    try {
      const outPlayer = activePlayers.find(p => p.id === selectedOutPlayer);
      const inPlayer = benchPlayers.find(p => p.id === selectedInPlayer);

      if (!outPlayer || !inPlayer) {
        setMessage("選手が見つかりません");
        return;
      }

      // 交代記録を保存
      const substitutionRecord: Omit<Substitution, 'id'> = {
        game_id: gameId,
        inning: currentInning,
        out_player_id: outPlayer.id,
        in_player_id: inPlayer.id,
        substitution_type: substitutionType,
        batting_order: outPlayer.batting_order,
        new_position: newPosition || outPlayer.position,
        description: `${outPlayer.player_name} → ${inPlayer.player_name}`
      };

      const { error: subError } = await supabase
        .from("game_substitutions")
        .insert(substitutionRecord);

      if (subError) {
        console.error("交代記録エラー:", subError);
        setMessage("交代記録の保存に失敗しました");
        return;
      }

      // 出場選手を非アクティブに
      const { error: outError } = await supabase
        .from("game_players")
        .update({ 
          is_active: false,
          position: null,
          batting_order: null
        })
        .eq("id", outPlayer.id);

      if (outError) {
        console.error("選手更新エラー:", outError);
        setMessage("選手情報の更新に失敗しました");
        return;
      }

      // 控え選手をアクティブに（打順と守備位置を引き継ぐ）
      const { error: inError } = await supabase
        .from("game_players")
        .update({ 
          is_active: true,
          position: newPosition || outPlayer.position,
          batting_order: outPlayer.batting_order
        })
        .eq("id", inPlayer.id);

      if (inError) {
        console.error("選手更新エラー:", inError);
        setMessage("選手情報の更新に失敗しました");
        return;
      }

      // 成功メッセージ
      setMessage("選手交代を完了しました");
      resetForm();
      await fetchPlayers();
      await fetchSubstitutions();

      if (onSubstitutionComplete) {
        onSubstitutionComplete();
      }

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("エラー:", error);
      setMessage("予期しないエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // 守備位置変更のみの処理
  const handlePositionChange = async (playerId: string, newPos: string) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from("game_players")
        .update({ position: newPos })
        .eq("id", playerId);

      if (error) {
        console.error("守備位置変更エラー:", error);
        return;
      }

      await fetchPlayers();
      setMessage("守備位置を変更しました");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("エラー:", error);
    }
  };

  const resetForm = () => {
    setSelectedOutPlayer("");
    setSelectedInPlayer("");
    setNewPosition("");
    setSubstitutionType("player_change");
  };

  if (!canEdit) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-600">編集権限がありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 現在の出場選手 */}
      <div>
        <h3 className="font-semibold text-lg mb-3">現在の出場選手</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePlayers.map((player) => (
              <div key={player.id} className="bg-white rounded-lg p-3 border">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">
                      {player.batting_order ? `${player.batting_order}番` : ""}
                    </span>
                    <span className="ml-2">{player.player_name}</span>
                  </div>
                  <select
                    value={player.position || ""}
                    onChange={(e) => handlePositionChange(player.id, e.target.value)}
                    className="ml-2 px-2 py-1 border rounded text-sm"
                  >
                    <option value="">守備位置</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 控え選手 */}
      {benchPlayers.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3">控え選手</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              {benchPlayers.map((player) => (
                <div key={player.id} className="bg-white rounded px-3 py-2 border">
                  {player.player_name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 選手交代フォーム */}
      <div className="border-t pt-6">
        <h3 className="font-semibold text-lg mb-3">選手交代</h3>
        <div className="space-y-4">
          {/* 交代タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              交代タイプ
            </label>
            <select
              value={substitutionType}
              onChange={(e) => setSubstitutionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="player_change">選手交代</option>
              <option value="pinch_hitter">代打</option>
              <option value="pinch_runner">代走</option>
              <option value="defensive_change">守備固め</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 交代する選手 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                交代する選手（OUT）
              </label>
              <select
                value={selectedOutPlayer}
                onChange={(e) => {
                  setSelectedOutPlayer(e.target.value);
                  // 守備位置を自動設定
                  const player = activePlayers.find(p => p.id === e.target.value);
                  if (player?.position) {
                    setNewPosition(player.position);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選択してください</option>
                {activePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.batting_order ? `${player.batting_order}番 ` : ""}
                    {player.player_name}
                    {player.position ? ` (${player.position})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 交代で入る選手 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                交代で入る選手（IN）
              </label>
              <select
                value={selectedInPlayer}
                onChange={(e) => setSelectedInPlayer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={benchPlayers.length === 0}
              >
                <option value="">選択してください</option>
                {benchPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.player_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 新しい守備位置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新しい守備位置
            </label>
            <select
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">変更なし</option>
              {POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          {/* 実行ボタン */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSubstitution}
              disabled={!selectedOutPlayer || !selectedInPlayer || saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "交代中..." : "選手交代を実行"}
            </button>
            {message && (
              <span className={`text-sm ${message.includes("失敗") ? "text-red-600" : "text-green-600"}`}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 交代履歴 */}
      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg">交代履歴</h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {showHistory ? "隠す" : "表示"}
          </button>
        </div>
        
        {showHistory && substitutions.length > 0 && (
          <div className="space-y-2">
            {substitutions.map((sub) => {
              const outPlayer = activePlayers.concat(benchPlayers).find(p => p.id === sub.out_player_id);
              const inPlayer = activePlayers.concat(benchPlayers).find(p => p.id === sub.in_player_id);
              
              return (
                <div key={sub.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span>
                      {sub.inning}回: {sub.description}
                    </span>
                    <span className="text-gray-500">
                      {sub.substitution_type === "pinch_hitter" && "代打"}
                      {sub.substitution_type === "pinch_runner" && "代走"}
                      {sub.substitution_type === "defensive_change" && "守備固め"}
                      {sub.substitution_type === "player_change" && "選手交代"}
                    </span>
                  </div>
                  {sub.new_position && (
                    <div className="text-gray-600 mt-1">
                      守備位置: {sub.new_position}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {showHistory && substitutions.length === 0 && (
          <p className="text-gray-500 text-sm">まだ交代はありません</p>
        )}
      </div>
    </div>
  );
}