"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

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
  hit_batters?: number;
  wild_pitches?: number;
  win?: boolean;
  loss?: boolean;
  save?: boolean;
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
};

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

  useEffect(() => {
    fetchData();
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

      if (playersData) {
        setPlayers(playersData);
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
    const scores: PlayerBattingBoxScore[] = playersData
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
          totalErrors: 0, // エラー数は別途計算が必要
        };
      });

    setBoxScores(scores);
  };

  const handleCellEdit = async (
    playerId: string,
    inning: number,
    field: string
  ) => {
    if (!isEditable || gameStatus === "finished") return;

    const cellKey = `${playerId}-${inning}-${field}`;
    setEditingCell(cellKey);

    // 既存の値を取得
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

  const saveEdit = async () => {
    if (!editingCell) return;

    const [playerId, inning, field] = editingCell.split("-");
    const inningNum = parseInt(inning);

    try {
      const existingRecord = battingRecords.find(
        (r) => r.player_id === playerId && r.inning === inningNum
      );

      if (existingRecord) {
        // 既存レコードを更新
        const updateData: any = {};
        if (field === "result") updateData.result = editValue;
        if (field === "rbi") updateData.rbi = parseInt(editValue) || 0;

        await supabase
          .from("game_batting_records")
          .update(updateData)
          .eq("id", existingRecord.id);
      } else if (editValue) {
        // 新規レコード作成
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

      // データを再取得
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
        <div className="bg-gray-100 px-4 py-2 border-b">
          <h3 className="font-bold text-lg">打撃成績</h3>
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
                  <td className="px-2 py-2 text-center text-sm">
                    {POSITION_MAP[boxScore.player.position || ""] || ""}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium">
                    {boxScore.player.player_name}
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
                        onClick={() =>
                          handleCellEdit(
                            boxScore.player.id,
                            inning + 1,
                            "result"
                          )
                        }
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyPress={(e) => e.key === "Enter" && saveEdit()}
                            className="w-full px-1 text-center"
                            autoFocus
                          />
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
      {pitchingRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b">
            <h3 className="font-bold text-lg">投手成績</h3>
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
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    死球
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    被安
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    被本
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    投球数
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    暴投
                  </th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center">
                    勝敗
                  </th>
                </tr>
              </thead>
              <tbody>
                {pitchingRecords.map((record, idx) => {
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
                      <td
                        className="px-2 py-2 text-center text-sm cursor-pointer hover:bg-gray-100"
                        onClick={() =>
                          isEditable &&
                          handlePitcherEdit(
                            record.player_id,
                            "earned_runs",
                            record.earned_runs + 1
                          )
                        }
                      >
                        {record.earned_runs}
                      </td>
                      <td
                        className="px-2 py-2 text-center text-sm cursor-pointer hover:bg-gray-100"
                        onClick={() =>
                          isEditable &&
                          handlePitcherEdit(
                            record.player_id,
                            "runs_allowed",
                            record.runs_allowed + 1
                          )
                        }
                      >
                        {record.runs_allowed}
                      </td>
                      <td
                        className="px-2 py-2 text-center text-sm cursor-pointer hover:bg-gray-100"
                        onClick={() =>
                          isEditable &&
                          handlePitcherEdit(
                            record.player_id,
                            "strikeouts",
                            record.strikeouts + 1
                          )
                        }
                      >
                        {record.strikeouts}
                      </td>
                      <td
                        className="px-2 py-2 text-center text-sm cursor-pointer hover:bg-gray-100"
                        onClick={() =>
                          isEditable &&
                          handlePitcherEdit(
                            record.player_id,
                            "walks",
                            record.walks + 1
                          )
                        }
                      >
                        {record.walks}
                      </td>
                      <td className="px-2 py-2 text-center text-sm">
                        {record.hit_batters || 0}
                      </td>
                      <td className="px-2 py-2 text-center text-sm">
                        {record.hits_allowed}
                      </td>
                      <td className="px-2 py-2 text-center text-sm">
                        {record.home_runs_allowed}
                      </td>
                      <td className="px-2 py-2 text-center text-sm">-</td>
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
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
