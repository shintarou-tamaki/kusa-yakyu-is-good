"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import BattingInputModal from "@/components/game/BattingInputModal";

interface GamePlayer {
  id: string;
  player_name: string;
  batting_order: number | null;
  position: string | null;
  team_member_id: string | null;
}

interface BattingRecord {
  id: string;
  game_id: string;
  player_id: string;
  inning: number;
  result: string;
  rbi: number;
  run_scored: boolean;
  stolen_base: boolean;
  base_reached?: number;
  notes?: string;
}

interface PitchingRecord {
  id: string;
  game_id: string;
  player_id: string;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  strikeouts: number;
  walks: number;
  home_runs_allowed: number;
  // 以下のフィールドはデータベースに存在しない可能性があるため削除
  // hit_batters?: number;
  // wild_pitches?: number;
  // win?: boolean;
  // loss?: boolean;
  // save?: boolean;
}

interface PlayerBattingBoxScore {
  player: GamePlayer;
  battingRecords: BattingRecord[];
  totalRbi: number;
  totalRuns: number;
  totalStolenBases: number;
  totalErrors: number;
}

interface Props {
  gameId: string;
  isEditable: boolean;
  gameStatus: string;
}

// 守備位置の日本語変換
const POSITION_MAP: Record<string, string> = {
  // 英語キー
  pitcher: "投",
  catcher: "捕",
  first: "一",
  second: "二",
  third: "三",
  shortstop: "遊",
  left: "左",
  center: "中",
  right: "右",
  dh: "DH",
  // 日本語キー（既に日本語で保存されている場合）
  投手: "投",
  捕手: "捕",
  一塁手: "一",
  二塁手: "二",
  三塁手: "三",
  遊撃手: "遊",
  左翼手: "左",
  中堅手: "中",
  右翼手: "右",
  指名打者: "DH",
};

// 打撃結果の選択肢
const BATTING_RESULTS = [
  { value: "", label: "-" },
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

// 入力モードタイプ
type InputMode = "view" | "simple" | "detailed";

// 詳細入力用の型定義
interface DetailedInputData {
  playerId: string;
  playerName: string;
  inning: number;
  existingRecord?: BattingRecord;
}

// 打撃結果のスタイリング
const getResultStyle = (result: string, notes?: string): string => {
  if (
    result === "安打" ||
    result === "二塁打" ||
    result === "三塁打" ||
    result === "本塁打"
  ) {
    return "bg-blue-600 text-white";
  }
  if (result === "四球" || result === "死球") {
    return "bg-yellow-100";
  }
  if (notes?.includes("失策")) {
    return "bg-orange-100";
  }
  return "";
};

// 打撃結果の短縮表記
const getShortResult = (
  result: string,
  rbi: number,
  notes?: string
): string => {
  const rbiText = rbi > 0 ? `(${rbi})` : "";

  const resultMap: Record<string, string> = {
    安打: "安",
    二塁打: "二",
    三塁打: "三",
    本塁打: "本",
    四球: "四球",
    死球: "死球",
    三振: "三振",
    ゴロ: "ゴ",
    フライ: "飛",
    ライナー: "直",
    犠打: "犠",
    犠飛: "犠飛",
    フィールダースチョイス: "野選",
  };

  let shortResult = resultMap[result] || result;

  // ポジション情報を付加
  if (notes) {
    if (notes.includes("投")) shortResult = "投" + shortResult;
    if (notes.includes("捕")) shortResult = "捕" + shortResult;
    if (notes.includes("一")) shortResult = "一" + shortResult;
    if (notes.includes("二")) shortResult = "二" + shortResult;
    if (notes.includes("三")) shortResult = "三" + shortResult;
    if (notes.includes("遊")) shortResult = "遊" + shortResult;
    if (notes.includes("左")) shortResult = "左" + shortResult;
    if (notes.includes("中")) shortResult = "中" + shortResult;
    if (notes.includes("右")) shortResult = "右" + shortResult;
    if (notes.includes("失策")) shortResult += "失";
  }

  return shortResult + rbiText;
};

// エラー数の自動集計
const calculateErrors = (battingRecords: BattingRecord[]): number => {
  return battingRecords.filter((record) => record.notes?.includes("失策"))
    .length;
};

// 投球回の表示形式変換
const formatInningsPitched = (innings: number): string => {
  const wholeInnings = Math.floor(innings);
  const outs = Math.round((innings - wholeInnings) * 10);

  if (outs === 0) {
    return `${wholeInnings}回`;
  } else {
    return `${wholeInnings}回${outs}/3`;
  }
};

export default function ScoreBoxDisplay({
  gameId,
  isEditable,
  gameStatus,
}: Props) {
  const supabase = createClientComponentClient();
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [battingRecords, setBattingRecords] = useState<BattingRecord[]>([]);
  const [pitchingRecords, setPitchingRecords] = useState<PitchingRecord[]>([]);
  const [boxScores, setBoxScores] = useState<PlayerBattingBoxScore[]>([]);
  const [maxInnings, setMaxInnings] = useState(7);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(true);
  // 入力モード管理
  const [inputMode, setInputMode] = useState<InputMode>("simple");
  const [showDetailedInput, setShowDetailedInput] = useState(false);
  const [detailedInputData, setDetailedInputData] =
    useState<DetailedInputData | null>(null);
  // 既存のstate定義の後に追加
  const [showPlayerAddModal, setShowPlayerAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<GamePlayer | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // 投手成績編集用のstate
  const [showPitchingModal, setShowPitchingModal] = useState(false);
  const [editingPitching, setEditingPitching] = useState<PitchingRecord | null>(
    null
  );
  const [newPitchingData, setNewPitchingData] = useState<
    Partial<PitchingRecord>
  >({
    innings_pitched: 0,
    hits_allowed: 0,
    runs_allowed: 0,
    earned_runs: 0,
    strikeouts: 0,
    walks: 0,
    home_runs_allowed: 0,
    // 存在しないフィールドを削除
    // hit_batters: 0,
    // wild_pitches: 0,
    // win: false,
    // loss: false,
    // save: false,
  });
  const [selectedPitcherId, setSelectedPitcherId] = useState("");

  // ScoreBoxDisplay内に追加
  const PlayerEditModal = () => {
    const [localPlayer, setLocalPlayer] = useState<Partial<GamePlayer>>(
      editingPlayer || { batting_order: players.length + 1 }
    );
    const [inputMode, setInputMode] = useState<"select" | "text">("select");

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-bold mb-4">
            {editingPlayer ? "選手編集" : "選手追加"}
          </h3>

          {/* 打順 */}
          {editingPlayer && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">打順</label>
              <input
                type="number"
                min="1"
                max="10"
                value={localPlayer.batting_order || ""}
                className="w-full p-2 border rounded"
                disabled
              />
            </div>
          )}

          {/* 選手名入力 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">選手名</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setInputMode("select")}
                className={`px-3 py-1 rounded ${
                  inputMode === "select"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200"
                }`}
              >
                メンバー選択
              </button>
              <button
                onClick={() => setInputMode("text")}
                className={`px-3 py-1 rounded ${
                  inputMode === "text"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200"
                }`}
              >
                直接入力
              </button>
            </div>

            {inputMode === "select" ? (
              <select
                value={localPlayer.team_member_id || ""}
                onChange={(e) => {
                  const memberId = e.target.value;
                  const member = teamMembers.find((m) => m.id === memberId);
                  setLocalPlayer({
                    ...localPlayer,
                    team_member_id: memberId,
                    player_name: member?.user_profiles?.display_name || "",
                  });
                }}
                className="w-full p-2 border rounded"
              >
                <option value="">選択してください</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user_profiles?.display_name || "名前未設定"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={localPlayer.player_name || ""}
                onChange={(e) =>
                  setLocalPlayer({
                    ...localPlayer,
                    player_name: e.target.value,
                    team_member_id: null,
                  })
                }
                placeholder="選手名を入力"
                className="w-full p-2 border rounded"
              />
            )}
          </div>

          {/* 守備位置 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">守備位置</label>
            <select
              value={localPlayer.position || ""}
              onChange={(e) =>
                setLocalPlayer({
                  ...localPlayer,
                  position: e.target.value,
                })
              }
              className="w-full p-2 border rounded"
            >
              <option value="">選択してください</option>
              <option value="pitcher">投手</option>
              <option value="catcher">捕手</option>
              <option value="first">一塁手</option>
              <option value="second">二塁手</option>
              <option value="third">三塁手</option>
              <option value="shortstop">遊撃手</option>
              <option value="left">左翼手</option>
              <option value="center">中堅手</option>
              <option value="right">右翼手</option>
              <option value="dh">指名打者</option>
            </select>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setEditingPlayer(null);
                setShowPlayerAddModal(false);
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              キャンセル
            </button>
            <button
              onClick={() => savePlayer(localPlayer)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!localPlayer.player_name}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  // チームメンバー取得関数
  const fetchTeamMembers = async () => {
    const { data: gameData } = await supabase
      .from("games")
      .select("home_team_id")
      .eq("id", gameId)
      .single();

    if (gameData?.home_team_id) {
      const { data: members } = await supabase
        .from("team_members")
        .select(
          `
        id,
        user_id,
        user_profiles (
          display_name
        )
      `
        )
        .eq("team_id", gameData.home_team_id);

      if (members) {
        setTeamMembers(members);
      }
    }
  };

  // 選手保存関数
  const savePlayer = async (playerData: Partial<GamePlayer>) => {
    try {
      if (playerData.id?.startsWith("temp-")) {
        // 新規作成
        const { data, error } = await supabase
          .from("game_players")
          .insert([
            {
              game_id: gameId,
              player_name: playerData.player_name,
              batting_order: playerData.batting_order,
              position: playerData.position,
              team_member_id: playerData.team_member_id,
              is_starter: true,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        // tempプレーヤーを実際のデータで置き換え
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerData.id ? data : p))
        );
      } else {
        // 既存更新
        const { error } = await supabase
          .from("game_players")
          .update({
            player_name: playerData.player_name,
            position: playerData.position,
            team_member_id: playerData.team_member_id,
          })
          .eq("id", playerData.id);

        if (error) throw error;

        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerData.id ? { ...p, ...playerData } : p
          )
        );
      }

      setEditingPlayer(null);
      setShowPlayerAddModal(false);
      await fetchData();
    } catch (error) {
      console.error("選手保存エラー:", error);
      alert("選手の保存に失敗しました");
    }
  };

  // 詳細入力モーダルを開く
  const openDetailedInput = (playerId: string, inning: number) => {
    const player = players.find((p) => p.id === playerId);
    const existingRecord = battingRecords.find(
      (r) => r.player_id === playerId && r.inning === inning
    );

    setDetailedInputData({
      playerId,
      playerName: player?.player_name || "",
      inning,
      existingRecord,
    });
    setShowDetailedInput(true);
  };

  // 打撃結果保存（整合性維持付き）
  const saveBattingWithIntegrity = async (
    playerId: string,
    inning: number,
    result: string,
    rbi: number,
    baseReached: number,
    runScored: boolean = false,
    stolenBase: boolean = false,
    notes: string = ""
  ) => {
    try {
      // 既存レコードの確認
      const existingRecord = battingRecords.find(
        (r) => r.player_id === playerId && r.inning === inning
      );

      const battingData = {
        game_id: gameId,
        player_id: playerId,
        inning,
        result,
        rbi,
        run_scored: runScored,
        stolen_base: stolenBase,
        base_reached: baseReached,
        notes: notes || null,
      };

      if (existingRecord) {
        // 更新処理
        await supabase
          .from("game_batting_records")
          .update(battingData)
          .eq("id", existingRecord.id);
      } else {
        // 新規作成
        await supabase.from("game_batting_records").insert([battingData]);
      }

      // ランナー管理（アウトでない場合）
      const { isOutResult } = await import("@/lib/game-logic");

      if (!isOutResult(result) || notes.includes("失策")) {
        // 既存ランナーの進塁処理
        const { advanceRunners } = await import("@/lib/game-logic");
        await advanceRunners(supabase, gameId, inning, baseReached);

        // 打者をランナーとして追加（ホームイン以外）
        if (baseReached > 0 && baseReached < 4) {
          // 既存の同じ選手のランナー記録を削除
          await supabase
            .from("game_runners")
            .delete()
            .eq("game_id", gameId)
            .eq("player_id", playerId)
            .eq("inning", inning);

          // 新しいランナーとして追加
          const player = players.find((p) => p.id === playerId);
          await supabase.from("game_runners").insert([
            {
              game_id: gameId,
              player_id: playerId,
              player_name: player?.player_name || "",
              inning,
              current_base: baseReached,
              is_active: true,
            },
          ]);
        }
      }

      // 得点の更新
      await updateGameScore();

      // データ再取得
      await fetchData();

      return true;
    } catch (error) {
      console.error("保存エラー:", error);
      return false;
    }
  };

  const handleSavePitching = async () => {
    if (!selectedPitcherId && !editingPitching) {
      alert("投手を選択してください");
      return;
    }

    // temp-で始まるIDの場合はエラー
    const playerId = editingPitching?.player_id || selectedPitcherId;
    if (playerId.startsWith("temp-")) {
      alert("先に選手を登録してください");
      return;
    }

    try {
      // データを詳細に確認
      const pitchingData = {
        game_id: gameId,
        player_id: playerId,
        innings_pitched: newPitchingData.innings_pitched || 0,
        hits_allowed: newPitchingData.hits_allowed || 0,
        runs_allowed: newPitchingData.runs_allowed || 0,
        earned_runs: newPitchingData.earned_runs || 0,
        strikeouts: newPitchingData.strikeouts || 0,
        walks: newPitchingData.walks || 0,
        home_runs_allowed: newPitchingData.home_runs_allowed || 0,
        // 存在しないフィールドを削除
        // hit_batters: newPitchingData.hit_batters || 0,
        // wild_pitches: newPitchingData.wild_pitches || 0,
        // win: newPitchingData.win || false,
        // loss: newPitchingData.loss || false,
        // save: newPitchingData.save || false,
      };

      console.log("保存するデータ:", pitchingData); // デバッグ用

      if (editingPitching) {
        // 既存投手成績の更新
        const { data, error } = await supabase
          .from("game_pitching_records")
          .update(pitchingData)
          .eq("id", editingPitching.id);

        if (error) {
          console.error("更新エラー詳細:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          throw error;
        }
        console.log("更新成功:", data);
      } else {
        // 新規投手成績の追加（配列で渡す）
        const { data, error } = await supabase
          .from("game_pitching_records")
          .insert([pitchingData])
          .select(); // 挿入後のデータを返す

        if (error) {
          console.error("追加エラー詳細:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          throw error;
        }
        console.log("追加成功:", data);
      }

      await fetchData();
      setShowPitchingModal(false);
      setEditingPitching(null);
      setNewPitchingData({
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        strikeouts: 0,
        walks: 0,
        home_runs_allowed: 0,
        hit_batters: 0,
        wild_pitches: 0,
        win: false,
        loss: false,
        save: false,
      });
      setSelectedPitcherId("");
    } catch (error: any) {
      console.error("投手成績保存エラー:", {
        message: error?.message || "不明なエラー",
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error,
      });
      alert(`保存に失敗しました: ${error?.message || "不明なエラー"}`);
    }
  };

  const handleDeletePitching = async (recordId: string) => {
    if (!confirm("この投手成績を削除しますか？")) return;

    try {
      const { error } = await supabase
        .from("game_pitching_records")
        .delete()
        .eq("id", recordId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    }
  };

  // 投球回数の処理関数
  const handleInningsPitchedChange = (value: string) => {
    const floatValue = parseFloat(value);
    if (isNaN(floatValue) || floatValue < 0) return;

    const wholeInnings = Math.floor(floatValue);
    const outs = Math.round((floatValue - wholeInnings) * 10);

    // 3アウト以上は次のイニングに繰り上げ
    const adjustedInnings = wholeInnings + Math.floor(outs / 3);
    const adjustedOuts = outs % 3;

    const finalValue = adjustedInnings + adjustedOuts / 10;
    setNewPitchingData((prev) => ({ ...prev, innings_pitched: finalValue }));
  };

  // 打点の自動計算
  const calculateAutoRbi = async (
    result: string,
    inning: number
  ): Promise<number> => {
    if (!["安打", "二塁打", "三塁打", "本塁打", "犠飛"].includes(result)) {
      return 0;
    }

    // 現在のランナーで得点圏（2塁・3塁）にいる人数を取得
    const { data: runners } = await supabase
      .from("game_runners")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", inning)
      .eq("is_active", true)
      .in("current_base", [2, 3]);

    const scoringPositionRunners = runners?.length || 0;

    // 打撃結果に応じた打点計算
    switch (result) {
      case "本塁打":
        // 本塁打は全ランナー+打者
        const { data: allRunners } = await supabase
          .from("game_runners")
          .select("*")
          .eq("game_id", gameId)
          .eq("inning", inning)
          .eq("is_active", true);
        return (allRunners?.length || 0) + 1;

      case "三塁打":
        // 三塁打は全ランナーがホームイン
        const { data: allRunnersForTriple } = await supabase
          .from("game_runners")
          .select("*")
          .eq("game_id", gameId)
          .eq("inning", inning)
          .eq("is_active", true);
        return allRunnersForTriple?.length || 0;

      case "二塁打":
        // 二塁打は2塁・3塁のランナーがホームイン
        return scoringPositionRunners;

      case "安打":
      case "犠飛":
        // 安打・犠飛は3塁ランナーのみホームイン
        const { data: thirdBaseRunner } = await supabase
          .from("game_runners")
          .select("*")
          .eq("game_id", gameId)
          .eq("inning", inning)
          .eq("is_active", true)
          .eq("current_base", 3);
        return thirdBaseRunner ? 1 : 0;

      default:
        return 0;
    }
  };

  // 得点の自動計算と反映
  const updateTeamScores = async () => {
    try {
      // 各イニングの得点を集計
      const { data: allRecords } = await supabase
        .from("game_batting_records")
        .select("*")
        .eq("game_id", gameId);

      if (!allRecords) return;

      // イニング毎の得点を計算
      const inningScores = new Map<number, number>();

      for (const record of allRecords) {
        if (record.run_scored) {
          const currentScore = inningScores.get(record.inning) || 0;
          inningScores.set(record.inning, currentScore + 1);
        }
      }

      // game_scoresテーブルを更新
      for (const [inning, runs] of inningScores) {
        await supabase.from("game_scores").upsert(
          {
            game_id: gameId,
            inning,
            top_score: runs, // TODO: 先攻/後攻の判定
            bottom_score: 0,
            is_my_team_bat_first: true, // TODO: 実際の値を取得
          },
          {
            onConflict: "game_id,inning",
          }
        );
      }

      // 合計得点を計算してgamesテーブルを更新
      const totalRuns = Array.from(inningScores.values()).reduce(
        (sum, runs) => sum + runs,
        0
      );

      await supabase
        .from("games")
        .update({
          home_score: totalRuns,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);
    } catch (error) {
      console.error("得点更新エラー:", error);
    }
  };

  // GameProgressPageとの互換性を保つための関数
  // GameProgressPageとの互換性を保つための関数
  const ensureCompatibility = async (
    playerId: string,
    inning: number,
    result: string
  ) => {
    // batting_orderの確認と設定
    const player = players.find((p) => p.id === playerId);
    if (player && !player.batting_order) {
      // 打順が設定されていない場合は自動設定
      const maxOrder = Math.max(...players.map((p) => p.batting_order || 0));
      await supabase
        .from("game_players")
        .update({ batting_order: maxOrder + 1 })
        .eq("id", playerId);
    }

    // アウトカウントの同期
    const { data: inningRecords } = await supabase
      .from("game_batting_records")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", inning);

    // importを関数の最初に移動
    const { isOutResult } = await import("@/lib/game-logic");

    let outs = 0;
    if (inningRecords) {
      // forEachをfor...ofループに変更
      for (const record of inningRecords) {
        if (isOutResult(record.result)) {
          if (record.notes?.includes("併殺")) {
            outs += 2;
          } else if (record.notes?.includes("三重殺")) {
            outs += 3;
          } else {
            outs += 1;
          }
        }
      }
    }

    // 3アウトで自動的にイニング終了処理
    if (outs >= 3) {
      // 全ランナーを非アクティブ化
      await supabase
        .from("game_runners")
        .update({ is_active: false })
        .eq("game_id", gameId)
        .eq("inning", inning);
    }
  };

  // ゲームスコアの更新
  const updateGameScore = async () => {
    try {
      // 全イニングの得点を集計
      const { data: allScores } = await supabase
        .from("game_scores")
        .select("*")
        .eq("game_id", gameId);

      if (allScores) {
        const homeTotal = allScores.reduce(
          (sum, s) => sum + (s.top_score || 0),
          0
        );
        const opponentTotal = allScores.reduce(
          (sum, s) => sum + (s.bottom_score || 0),
          0
        );

        await supabase
          .from("games")
          .update({
            home_score: homeTotal,
            opponent_score: opponentTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", gameId);
      }
    } catch (error) {
      console.error("スコア更新エラー:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTeamMembers(); // チームメンバー取得を追加

    // リアルタイム更新のサブスクリプション設定
    const battingSubscription = supabase
      .channel(`batting_records_${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_batting_records",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log("打撃記録更新:", payload);
          fetchData();
        }
      )
      .subscribe();

    const runnersSubscription = supabase
      .channel(`runners_${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_runners",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log("ランナー更新:", payload);
          fetchData();
        }
      )
      .subscribe();

    const scoresSubscription = supabase
      .channel(`scores_${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_scores",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log("スコア更新:", payload);
          // スコアが更新されたら画面を更新
          fetchData();
        }
      )
      .subscribe();

    // クリーンアップ
    return () => {
      battingSubscription.unsubscribe();
      runnersSubscription.unsubscribe();
      scoresSubscription.unsubscribe();
    };
  }, [gameId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 選手データ取得
      const { data: playersData } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .order("batting_order", { ascending: true });

      if (playersData && playersData.length > 0) {
        setPlayers(playersData);
      } else {
        // データがない場合は空の9人分のスロットを作成
        const emptyPlayers: GamePlayer[] = [];
        for (let i = 1; i <= 9; i++) {
          emptyPlayers.push({
            id: `temp-${i}`,
            player_name: "",
            batting_order: i,
            position: "",
            team_member_id: null,
          });
        }
        setPlayers(emptyPlayers);
      }

      // 打撃記録取得
      const { data: battingData } = await supabase
        .from("game_batting_records")
        .select("*")
        .eq("game_id", gameId)
        .order("inning", { ascending: true });

      if (battingData) {
        setBattingRecords(battingData);
        const maxInning = Math.max(...battingData.map((r) => r.inning), 7);
        setMaxInnings(maxInning);
      }

      // 投手記録取得
      const { data: pitchingData } = await supabase
        .from("game_pitching_records")
        .select("*")
        .eq("game_id", gameId);

      if (pitchingData) {
        setPitchingRecords(pitchingData);
      }

      // ボックススコアを生成
      if (playersData && battingData) {
        generateBoxScores(playersData, battingData);
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateBoxScores = (
    playersData: GamePlayer[],
    battingData: BattingRecord[]
  ) => {
    // 空の選手データも含めて処理
    const processedPlayers = playersData.length > 0 ? playersData : players; // 既にセットされた空の選手データを使用

    const scores: PlayerBattingBoxScore[] = processedPlayers
      .filter((p) => p.batting_order !== null)
      .sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0))
      .map((player) => {
        const playerRecords = battingData.filter(
          (r) => r.player_id === player.id
        );

        return {
          player,
          battingRecords: playerRecords,
          totalRbi: playerRecords.reduce((sum, r) => sum + r.rbi, 0),
          totalRuns: playerRecords.filter((r) => r.run_scored).length,
          totalStolenBases: playerRecords.filter((r) => r.stolen_base).length,
          totalErrors: calculateErrors(playerRecords), // エラー数を自動計算
        };
      });

    setBoxScores(scores);
  };

  // handleCellEdit関数 - 守備位置編集に対応
  const handleCellEdit = async (
    playerId: string,
    inning: number,
    field: string
  ) => {
    if (!isEditable || gameStatus === "finished") return;

    const cellKey = `${playerId}-${inning}-${field}`;
    setEditingCell(cellKey);

    // 守備位置編集の場合
    if (field === "position") {
      const player = players.find((p) => p.id === playerId);
      setEditValue(player?.position || "");
      return;
    }

    // 既存の打撃結果編集処理
    const record = battingRecords.find(
      (r) => r.player_id === playerId && r.inning === inning
    );

    if (record) {
      if (field === "result") setEditValue(record.result);
      if (field === "rbi") setEditValue(record.rbi.toString());
    } else {
      setEditValue("");
    }
  };

  // saveEdit関数 - 守備位置保存に対応
  const saveEdit = async () => {
    if (!editingCell) return;

    const [playerId, inning, field] = editingCell.split("-");
    const inningNum = parseInt(inning);

    try {
      // 守備位置の保存処理
      if (field === "position") {
        await supabase
          .from("game_players")
          .update({ position: editValue || null })
          .eq("id", playerId);

        await fetchData();
        setEditingCell(null);
        setEditValue("");
        return;
      }

      // 既存の打撃結果保存処理
      const existingRecord = battingRecords.find(
        (r) => r.player_id === playerId && r.inning === inningNum
      );

      if (existingRecord) {
        const updateData: any = {};
        if (field === "result") updateData.result = editValue;
        if (field === "rbi") updateData.rbi = parseInt(editValue) || 0;

        await supabase
          .from("game_batting_records")
          .update(updateData)
          .eq("id", existingRecord.id);
      } else if (editValue) {
        const newRecord: any = {
          game_id: gameId,
          player_id: playerId,
          inning: inningNum,
          result: field === "result" ? editValue : "",
          rbi: field === "rbi" ? parseInt(editValue) || 0 : 0,
          run_scored: false,
          stolen_base: false,
        };

        await supabase.from("game_batting_records").insert(newRecord);
      }

      await fetchData();
    } catch (error) {
      console.error("保存エラー:", error);
    } finally {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const handlePitcherEdit = async (
    pitcherId: string,
    field: string,
    value: any
  ) => {
    if (!isEditable || gameStatus === "finished") return;

    try {
      const record = pitchingRecords.find((r) => r.player_id === pitcherId);

      if (record) {
        const updateData: any = {};
        updateData[field] = value;

        await supabase
          .from("game_pitching_records")
          .update(updateData)
          .eq("id", record.id);

        await fetchData();
      }
    } catch (error) {
      console.error("投手成績更新エラー:", error);
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 打撃成績表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">打撃成績</h3>
          {isEditable && (
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setInputMode(inputMode === "detailed" ? "simple" : "detailed")
                }
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {inputMode === "detailed" ? "簡易編集" : "詳細入力"}
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                  打順
                </th>
                <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                  守備
                </th>
                <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left">
                  選手名
                </th>
                {[...Array(maxInnings)].map((_, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-xs font-medium text-gray-700 text-center min-w-[3rem]"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                  打点
                </th>
                <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                  盗塁
                </th>
                <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                  得点
                </th>
                <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                  失策
                </th>
              </tr>
            </thead>
            <tbody>
              {boxScores.map((boxScore, idx) => (
                <tr
                  key={boxScore.player.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-2 py-2 text-center font-medium text-sm">
                    {boxScore.player.batting_order}
                  </td>
                  {/* 守備位置 - 編集可能 */}
                  <td
                    className={`px-2 py-2 text-center text-sm ${
                      isEditable ? "cursor-pointer hover:bg-gray-100" : ""
                    }`}
                    onClick={() =>
                      isEditable &&
                      handleCellEdit(boxScore.player.id, 0, "position")
                    }
                  >
                    {editingCell === `${boxScore.player.id}-0-position` ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onClick={(e) => e.stopPropagation()}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit();
                          }
                        }}
                        className="w-full px-1 text-center text-sm border border-gray-300 rounded"
                        autoFocus
                      >
                        <option value="">-</option>
                        <option value="pitcher">投</option>
                        <option value="catcher">捕</option>
                        <option value="first">一</option>
                        <option value="second">二</option>
                        <option value="third">三</option>
                        <option value="shortstop">遊</option>
                        <option value="left">左</option>
                        <option value="center">中</option>
                        <option value="right">右</option>
                        <option value="dh">DH</option>
                      </select>
                    ) : boxScore.player.position ? (
                      POSITION_MAP[boxScore.player.position] ||
                      boxScore.player.position
                    ) : (
                      "-"
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-sm font-medium ${
                      !boxScore.player.player_name && isEditable
                        ? "cursor-pointer hover:bg-gray-100"
                        : ""
                    }`}
                    onClick={() => {
                      if (isEditable && !boxScore.player.player_name) {
                        setEditingPlayer(boxScore.player);
                        setShowPlayerAddModal(true);
                      }
                    }}
                  >
                    {boxScore.player.player_name ||
                      (isEditable ? (
                        <span className="text-gray-400">
                          クリックして選手追加
                        </span>
                      ) : (
                        "-"
                      ))}
                  </td>
                  {[...Array(maxInnings)].map((_, inning) => {
                    const record = boxScore.battingRecords.find(
                      (r) => r.inning === inning + 1
                    );
                    const cellKey = `${boxScore.player.id}-${
                      inning + 1
                    }-result`;
                    const isEditing = editingCell === cellKey;

                    return (
                      <td
                        key={inning}
                        className={`px-1 py-1 text-center text-xs border-l cursor-pointer hover:bg-gray-100 ${
                          record
                            ? getResultStyle(record.result, record.notes)
                            : ""
                        }`}
                        onClick={() => {
                          if (inputMode === "detailed") {
                            openDetailedInput(boxScore.player.id, inning + 1);
                          } else {
                            handleCellEdit(
                              boxScore.player.id,
                              inning + 1,
                              "result"
                            );
                          }
                        }}
                      >
                        {isEditing ? (
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-1 text-center text-xs border border-gray-300 rounded"
                            autoFocus
                          >
                            {BATTING_RESULTS.map((result) => (
                              <option key={result.value} value={result.value}>
                                {result.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="block px-1 py-1">
                            {record
                              ? getShortResult(
                                  record.result,
                                  record.rbi,
                                  record.notes
                                )
                              : ""}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-sm font-medium border-l">
                    {boxScore.totalRbi}
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    {boxScore.totalStolenBases}
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    {boxScore.totalRuns}
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    {boxScore.totalErrors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 投手成績表 */}
      {(pitchingRecords.length > 0 || isEditable) && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
            <h3 className="font-bold text-lg">投手成績</h3>
            {isEditable && (
              <button
                onClick={() => setShowPitchingModal(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                投手追加
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left">
                    投手名
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    イニング数
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    自責点
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    失点
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    三振
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    四球
                  </th>
                  {/* 死球列を削除
<th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
  死球
</th> */}
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    被安
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    被本
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    投球数
                  </th>
                  {/* 暴投列を削除
<th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
  暴投
</th>
<th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
  勝敗
</th> */}
                  {isEditable && (
                    <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                      操作
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pitchingRecords.length > 0 ? (
                  pitchingRecords.map((record, idx) => {
                    const pitcher = players.find(
                      (p) => p.id === record.player_id
                    );

                    return (
                      <tr
                        key={record.id}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-3 py-2 text-sm font-medium">
                          {pitcher?.player_name || "不明"}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">
                          {formatInningsPitched(record.innings_pitched)}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">
                          {record.earned_runs}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">
                          {record.runs_allowed}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">
                          {record.strikeouts}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">
                          {record.walks}
                        </td>
                        {/* 死球列を削除
<td className="px-2 py-2 text-center text-sm">
  {record.hit_batters || 0}
</td> */}
                        <td className="px-2 py-2 text-center text-sm">
                          {record.hits_allowed}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">
                          {record.home_runs_allowed}
                        </td>
                        <td className="px-2 py-2 text-center text-sm">-</td>
                        {/* 暴投、勝敗列を削除
<td className="px-2 py-2 text-center text-sm">
  {record.wild_pitches || 0}
</td>
<td className="px-2 py-2 text-center text-sm">
  {record.win
    ? "勝"
    : record.loss
    ? "負"
    : record.save
    ? "S"
    : "-"}
</td> */}
                        {isEditable && (
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => {
                                setEditingPitching(record);
                                setNewPitchingData({
                                  innings_pitched: record.innings_pitched,
                                  hits_allowed: record.hits_allowed,
                                  runs_allowed: record.runs_allowed,
                                  earned_runs: record.earned_runs,
                                  strikeouts: record.strikeouts,
                                  walks: record.walks,
                                  home_runs_allowed: record.home_runs_allowed,
                                  hit_batters: record.hit_batters || 0,
                                  wild_pitches: record.wild_pitches || 0,
                                  win: record.win || false,
                                  loss: record.loss || false,
                                  save: record.save || false,
                                });
                                setSelectedPitcherId(record.player_id);
                                setShowPitchingModal(true);
                              }}
                              className="text-blue-600 hover:underline text-xs mr-2"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDeletePitching(record.id)}
                              className="text-red-600 hover:underline text-xs"
                            >
                              削除
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={isEditable ? 10 : 9} // 13から10、12から9に変更
                      className="text-center py-4 text-gray-500"
                    >
                      投手成績がありません。
                      {isEditable && "「投手追加」ボタンから追加してください。"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 編集モードの説明 */}
      {isEditable && gameStatus !== "finished" && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-800">
            💡
            セルをクリックして編集できます。Enterキーまたはセル外をクリックで保存されます。
          </p>
        </div>
      )}

      {/* 詳細入力モーダル */}
      {showDetailedInput && detailedInputData && (
        <BattingInputModal
          gameId={gameId}
          playerId={detailedInputData.playerId}
          playerName={detailedInputData.playerName}
          inning={detailedInputData.inning}
          existingRecord={detailedInputData.existingRecord}
          onClose={() => {
            setShowDetailedInput(false);
            setDetailedInputData(null);
          }}
          onSave={fetchData}
        />
      )}

      {/* 選手追加/編集モーダル */}
      {showPlayerAddModal && <PlayerEditModal />}

      {/* 投手成績編集モーダル */}
      {showPitchingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingPitching ? "投手成績編集" : "投手成績追加"}
            </h3>

            {/* 投手選択（新規追加時のみ） */}
            {!editingPitching && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  投手 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPitcherId}
                  onChange={(e) => setSelectedPitcherId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">選択してください</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.player_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 投球回数 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                投球回数（0.1 = 1アウト、0.2 = 2アウト）
              </label>
              <input
                type="number"
                step="0.1"
                value={newPitchingData.innings_pitched || 0}
                onChange={(e) => handleInningsPitchedChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* 成績入力（2列表示） */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">被安打</label>
                <input
                  type="number"
                  min="0"
                  value={newPitchingData.hits_allowed || 0}
                  onChange={(e) =>
                    setNewPitchingData((prev) => ({
                      ...prev,
                      hits_allowed: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">失点</label>
                <input
                  type="number"
                  min="0"
                  value={newPitchingData.runs_allowed || 0}
                  onChange={(e) =>
                    setNewPitchingData((prev) => ({
                      ...prev,
                      runs_allowed: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">自責点</label>
                <input
                  type="number"
                  min="0"
                  value={newPitchingData.earned_runs || 0}
                  onChange={(e) =>
                    setNewPitchingData((prev) => ({
                      ...prev,
                      earned_runs: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">奪三振</label>
                <input
                  type="number"
                  min="0"
                  value={newPitchingData.strikeouts || 0}
                  onChange={(e) =>
                    setNewPitchingData((prev) => ({
                      ...prev,
                      strikeouts: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">四球</label>
                <input
                  type="number"
                  min="0"
                  value={newPitchingData.walks || 0}
                  onChange={(e) =>
                    setNewPitchingData((prev) => ({
                      ...prev,
                      walks: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 死球入力を削除
<div>
  <label className="block text-sm font-medium mb-2">死球</label>
  <input
    type="number"
    min="0"
    value={newPitchingData.hit_batters || 0}
    onChange={(e) =>
      setNewPitchingData((prev) => ({
        ...prev,
        hit_batters: parseInt(e.target.value) || 0,
      }))
    }
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  />
</div> */}

              <div>
                <label className="block text-sm font-medium mb-2">
                  被本塁打
                </label>
                <input
                  type="number"
                  min="0"
                  value={newPitchingData.home_runs_allowed || 0}
                  onChange={(e) =>
                    setNewPitchingData((prev) => ({
                      ...prev,
                      home_runs_allowed: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 暴投入力を削除
<div>
  <label className="block text-sm font-medium mb-2">暴投</label>
  <input
    type="number"
    min="0"
    value={newPitchingData.wild_pitches || 0}
    onChange={(e) =>
      setNewPitchingData((prev) => ({
        ...prev,
        wild_pitches: parseInt(e.target.value) || 0,
      }))
    }
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  />
</div> */}
            </div>

            {/* 勝敗セーブ全体を削除
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                勝敗・セーブ
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pitching_result"
                    checked={newPitchingData.win === true}
                    onChange={() =>
                      setNewPitchingData((prev) => ({
                        ...prev,
                        win: true,
                        loss: false,
                        save: false,
                      }))
                    }
                    className="mr-2"
                  />
                  勝
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pitching_result"
                    checked={newPitchingData.loss === true}
                    onChange={() =>
                      setNewPitchingData((prev) => ({
                        ...prev,
                        win: false,
                        loss: true,
                        save: false,
                      }))
                    }
                    className="mr-2"
                  />
                  負
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pitching_result"
                    checked={newPitchingData.save === true}
                    onChange={() =>
                      setNewPitchingData((prev) => ({
                        ...prev,
                        win: false,
                        loss: false,
                        save: true,
                      }))
                    }
                    className="mr-2"
                  />
                  セーブ
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pitching_result"
                    checked={
                      !newPitchingData.win &&
                      !newPitchingData.loss &&
                      !newPitchingData.save
                    }
                    onChange={() =>
                      setNewPitchingData((prev) => ({
                        ...prev,
                        win: false,
                        loss: false,
                        save: false,
                      }))
                    }
                    className="mr-2"
                  />
                  なし
                </label>
              </div>
            </div> */}

            {/* ボタン */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPitchingModal(false);
                  setEditingPitching(null);
                  setNewPitchingData({
                    innings_pitched: 0,
                    hits_allowed: 0,
                    runs_allowed: 0,
                    earned_runs: 0,
                    strikeouts: 0,
                    walks: 0,
                    home_runs_allowed: 0,
                    hit_batters: 0,
                    wild_pitches: 0,
                    win: false,
                    loss: false,
                    save: false,
                  });
                  setSelectedPitcherId("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSavePitching}
                disabled={!editingPitching && !selectedPitcherId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
