"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import DoublePlaySelector from "./DoublePlaySelector";

interface GamePlayer {
  id: string;
  player_name: string;
  batting_order: number | null;
  position: string | null;
}

interface BattingRecord {
  id: string;
  game_id: string;
  player_id: string;
  inning: number;
  batting_order: number;
  result: string;
  rbi: number;
  run_scored: boolean;
  stolen_base: boolean;
  base_reached?: number;
  stolen_bases_detail?: any;
  notes: string;
}

interface Props {
  gameId: string;
  players: GamePlayer[];
  currentInning: number;
  isTopBottom: "top" | "bottom";
  canEdit: boolean;
  onRecordSaved?: () => void;
  onInningChange?: (newInning: number, newTopBottom: "top" | "bottom") => void;
  onGameEnd?: () => void;
}

// 打撃結果の定義
const BATTING_RESULTS = {
  hits: [
    { value: "hit", label: "安打", dbValue: "安打" },
    { value: "double", label: "二塁打", dbValue: "二塁打" },
    { value: "triple", label: "三塁打", dbValue: "三塁打" },
    { value: "homerun", label: "本塁打", dbValue: "本塁打" },
  ],
  outs: [
    { value: "strikeout", label: "三振", dbValue: "三振" },
    { value: "groundout", label: "ゴロ", dbValue: "ゴロ" },
    { value: "flyout", label: "フライ", dbValue: "フライ" },
    { value: "lineout", label: "ライナー", dbValue: "ライナー" },
    { value: "sacrifice_bunt", label: "犠打", dbValue: "犠打" },
    { value: "sacrifice_fly", label: "犠飛", dbValue: "犠飛" },
    {
      value: "fielders_choice",
      label: "フィールダースチョイス",
      dbValue: "フィールダースチョイス",
    },
  ],
  others: [
    { value: "walk", label: "四球", dbValue: "四球" },
    { value: "hit_by_pitch", label: "死球", dbValue: "死球" },
    { value: "error", label: "エラー", dbValue: "エラー" },
    { value: "fielders_choice_safe", label: "野選", dbValue: "野選" },
  ],
};

// アウトになる結果を定義
const OUT_RESULTS = [
  "三振",
  "ゴロ",
  "フライ",
  "ライナー",
  "犠打",
  "犠飛",
  "フィールダースチョイス",
];

// 出塁する結果（到達塁の選択が必要）
const ON_BASE_RESULTS = [
  "安打",
  "二塁打",
  "三塁打",
  "本塁打",
  "四球",
  "死球",
  "エラー",
  "野選",
];

// 草野球の最大イニング数
const MAX_INNINGS = 7;

export default function BattingRecordInput({
  gameId,
  players,
  currentInning,
  isTopBottom,
  canEdit,
  onRecordSaved,
  onInningChange,
  onGameEnd,
}: Props) {
  const supabase = createClientComponentClient();

  const [selectedPlayer, setSelectedPlayer] = useState<GamePlayer | null>(null);
  const [battingResult, setBattingResult] = useState<string>("");
  const [rbi, setRbi] = useState<number>(0);
  const [runScored, setRunScored] = useState<boolean>(false);
  const [stolenBase, setStolenBase] = useState<boolean>(false);
  const [baseReached, setBaseReached] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [currentBatterIndex, setCurrentBatterIndex] = useState(0);
  const [inningRecords, setInningRecords] = useState<BattingRecord[]>([]);
  const [currentOuts, setCurrentOuts] = useState(0);
  const [isInningLocked, setIsInningLocked] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BattingRecord | null>(
    null
  );
  const [showDoublePlaySelector, setShowDoublePlaySelector] = useState(false);
  const [pendingBattingData, setPendingBattingData] = useState<any>(null);

  // スターティングメンバーのみをフィルタリング
  const battingLineup = players
    .filter((p) => p.batting_order !== null)
    .sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0));

  // ランナーを進塁させる処理（改善版）
  const advanceRunners = async (
    batterBaseReached: number,
    batterId: string
  ) => {
    if (batterBaseReached <= 0) return;

    // 現在のランナーを取得（塁の大きい順にソート）
    const { data: currentRunners } = await supabase
      .from("game_runners")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", currentInning)
      .eq("is_active", true)
      .order("current_base", { ascending: false });

    if (!currentRunners || currentRunners.length === 0) return;

    // 各塁の占有状況を確認
    const basesOccupied = new Set(currentRunners.map((r) => r.current_base));

    // 進塁処理（塁の大きい順に処理）
    for (const runner of currentRunners) {
      let newBase = runner.current_base;

      // 強制進塁の判定
      if (batterBaseReached === 1) {
        // 単打・四球・死球の場合：詰まっている塁のランナーのみ進塁
        if (runner.current_base === 1) {
          newBase = 2;
        } else if (runner.current_base === 2 && basesOccupied.has(1)) {
          newBase = 3;
        } else if (
          runner.current_base === 3 &&
          basesOccupied.has(2) &&
          basesOccupied.has(1)
        ) {
          newBase = 4;
        }
      } else if (batterBaseReached === 2) {
        // 二塁打の場合：全ランナー2塁進塁
        newBase = Math.min(runner.current_base + 2, 4);
      } else if (batterBaseReached === 3) {
        // 三塁打の場合：全ランナー3塁進塁（実質ホームイン）
        newBase = 4;
      } else if (batterBaseReached === 4) {
        // 本塁打の場合：全ランナーホームイン
        newBase = 4;
      }

      // ランナーの位置を更新
      if (newBase !== runner.current_base) {
        if (newBase === 4) {
          // ホームイン（得点）
          await supabase
            .from("game_runners")
            .update({
              current_base: 4,
              is_active: false,
            })
            .eq("id", runner.id);

          // 得点記録も更新
          await supabase
            .from("game_batting_records")
            .update({ run_scored: true })
            .eq("game_id", gameId)
            .eq("player_id", runner.player_id)
            .eq("inning", currentInning);
        } else {
          // 進塁
          await supabase
            .from("game_runners")
            .update({ current_base: newBase })
            .eq("id", runner.id);
        }
      }
    }
  };

  // useEffectやその他の関数
  useEffect(() => {
    const loadData = async () => {
      if (canEdit) {
        await fetchInningRecords();
        await calculateNextBatter();
      }
    };
    loadData();
  }, [currentInning, isTopBottom, canEdit, players]);

  const calculateNextBatter = async () => {
    if (battingLineup.length === 0) return;

    // 試合全体の打撃記録を取得して最後の打者を特定
    const { data: allGameRecords } = await supabase
      .from("game_batting_records")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!allGameRecords || allGameRecords.length === 0) {
      // まだ記録がない場合は1番打者から開始
      setCurrentBatterIndex(0);
      if (!editMode) {
        setSelectedPlayer(battingLineup[0]);
      }
      return;
    }

    // 最後に打席に立った選手を特定
    const lastBatterId = allGameRecords[0].player_id;
    const lastBatterIndex = battingLineup.findIndex(
      (p) => p.id === lastBatterId
    );

    // 次の打者のインデックスを計算（打順は循環する）
    let nextIndex = 0;
    if (lastBatterIndex >= 0) {
      nextIndex = (lastBatterIndex + 1) % battingLineup.length;
    } else {
      // 最後の打者が現在のラインナップにいない場合（交代などで）
      // 現在のイニングの記録から推測
      const currentInningRecordsCount = inningRecords.length;
      nextIndex = currentInningRecordsCount % battingLineup.length;
    }

    setCurrentBatterIndex(nextIndex);
    if (!editMode) {
      setSelectedPlayer(battingLineup[nextIndex]);
    }
  };

  const fetchInningRecords = async () => {
    const { data, error } = await supabase
      .from("game_batting_records")
      .select("*")
      .eq("game_id", gameId)
      .eq("inning", currentInning)
      .order("created_at", { ascending: true });

    if (data) {
      setInningRecords(data);

      // アウト数を計算（併殺・三重殺を考慮）
      let totalOuts = 0;
      data.forEach((record) => {
        if (OUT_RESULTS.includes(record.result)) {
          // アウトになる結果の場合
          if (record.notes?.includes("併殺（ダブルプレー）")) {
            // ダブルプレーの場合は2アウト
            totalOuts += 2;
          } else if (record.notes?.includes("三重殺（トリプルプレー）")) {
            // トリプルプレーの場合は3アウト
            totalOuts += 3;
          } else {
            // 通常のアウトは1アウト
            totalOuts += 1;
          }
        }
      });

      setCurrentOuts(totalOuts);
      setIsInningLocked(totalOuts >= 3);
    }
  };

  const resetForm = () => {
    setBattingResult("");
    setRbi(0);
    setRunScored(false);
    setStolenBase(false);
    setBaseReached(0);
    setNotes("");
    setEditMode(false);
    setEditingRecord(null);
    setShowDoublePlaySelector(false);
    setPendingBattingData(null);
  };

  // ダブルプレー処理
  const handleDoublePlay = async (runnerIds: string[]) => {
    try {
      setSaving(true);

      // 選択されたランナーをアウトにする
      if (runnerIds.length > 0) {
        // ランナーを非アクティブにする
        const { error: runnerError } = await supabase
          .from("game_runners")
          .update({ is_active: false })
          .in("id", runnerIds);

        if (runnerError) throw runnerError;
      }

      // 保留中の打撃記録を保存（併殺情報を含む）
      if (pendingBattingData) {
        let noteText = "";
        if (runnerIds.length === 1) {
          noteText = "併殺（ダブルプレー）";
        } else if (runnerIds.length === 2) {
          noteText = "三重殺（トリプルプレー）";
        }

        const { error } = await supabase.from("game_batting_records").insert({
          ...pendingBattingData,
          notes: runnerIds.length > 0 ? noteText : pendingBattingData.notes,
        });

        if (error) throw error;
      }

      // アウトカウントを正しく計算（打者 + ランナー）
      const additionalOuts = 1 + runnerIds.length; // 打者1 + ランナーの数
      const newTotalOuts = currentOuts + additionalOuts;

      // メッセージを設定
      if (runnerIds.length === 0) {
        // 通常のゴロアウト
        setMessage(newTotalOuts >= 3 ? "スリーアウトチェンジ！" : "アウト！");
      } else if (runnerIds.length === 1) {
        // ダブルプレー
        setMessage(
          newTotalOuts >= 3
            ? "併殺！ダブルプレーでチェンジ！"
            : "併殺！ダブルプレー！"
        );
      } else if (runnerIds.length === 2) {
        // トリプルプレー
        setMessage("三重殺！トリプルプレーでチェンジ！");
      }

      // リセット
      setShowDoublePlaySelector(false);
      setPendingBattingData(null);
      resetForm();

      // 記録だけを再取得（アウトカウントは手動で設定）
      const { data } = await supabase
        .from("game_batting_records")
        .select("*")
        .eq("game_id", gameId)
        .eq("inning", currentInning)
        .order("created_at", { ascending: true });

      if (data) {
        setInningRecords(data);
      }

      // アウトカウントを設定（fetchInningRecordsは呼ばない）
      setCurrentOuts(newTotalOuts);
      setIsInningLocked(newTotalOuts >= 3);

      // スコア更新と次打者の計算
      await updateGameScore();
      await calculateNextBatter();

      // 3アウトの場合はイニング交代
      if (newTotalOuts >= 3) {
        // ランナーをクリア
        await supabase
          .from("game_runners")
          .update({ is_active: false })
          .eq("game_id", gameId)
          .eq("inning", currentInning);

        // イニング交代処理
        // 注意: isTopBottomはPropsから受け取っている変数名
        if (currentInning >= MAX_INNINGS && isTopBottom === "bottom") {
          // 7回裏終了で試合終了
          if (onGameEnd) {
            onGameEnd();
          }
        } else if (onInningChange) {
          // 次のイニングへ
          const nextTopBottom = isTopBottom === "top" ? "bottom" : "top";
          const nextInning =
            isTopBottom === "bottom" ? currentInning + 1 : currentInning;

          // 親コンポーネントに通知
          onInningChange(nextInning, nextTopBottom);
        }
      } else {
        // 3アウトでない場合も親コンポーネントに通知
        if (onRecordSaved) onRecordSaved();
      }
    } catch (error) {
      console.error("併殺処理エラー:", error);
      setMessage("エラーが発生しました");
    } finally {
      setSaving(false);
      setShowDoublePlaySelector(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!selectedPlayer || !battingResult) {
      setMessage("選手と結果を選択してください");
      return;
    }

    // 出塁する結果の場合、到達塁が選択されているか確認
    const allResults = [
      ...BATTING_RESULTS.hits,
      ...BATTING_RESULTS.outs,
      ...BATTING_RESULTS.others,
    ];
    const selectedResult = allResults.find((r) => r.value === battingResult);
    const dbValue = selectedResult?.dbValue || battingResult;

    if (ON_BASE_RESULTS.includes(dbValue) && baseReached === 0) {
      setMessage("到達塁を選択してください");
      return;
    }

    setSaving(true);

    try {
      // 現在のアウト数を計算
      const isOut = OUT_RESULTS.includes(dbValue);

      if (editingRecord && editMode) {
        // 編集モード
        const { error } = await supabase
          .from("game_batting_records")
          .update({
            player_id: selectedPlayer.id,
            result: dbValue,
            rbi: rbi,
            run_scored: runScored,
            stolen_base: stolenBase,
            base_reached: baseReached,
            notes: notes || null,
          })
          .eq("id", editingRecord.id);

        if (error) throw error;

        // 既存のランナー記録を更新
        // まず、このプレイヤーの既存のランナー記録を削除
        await supabase
          .from("game_runners")
          .delete()
          .eq("game_id", gameId)
          .eq("player_id", selectedPlayer.id)
          .eq("inning", currentInning);

        // 新しいランナー記録を作成（出塁した場合のみ）
        if (baseReached > 0 && baseReached < 4) {
          await supabase.from("game_runners").insert({
            game_id: gameId,
            inning: currentInning,
            player_id: selectedPlayer.id,
            player_name: selectedPlayer.player_name,
            current_base: baseReached,
            is_active: true,
          });
        }

        setEditMode(false);
        setEditingRecord(null);
        setMessage("記録を更新しました");
      } else {
        // 新規作成
        const recordData = {
          game_id: gameId,
          player_id: selectedPlayer.id,
          inning: currentInning,
          batting_order: selectedPlayer.batting_order || 0,
          result: dbValue,
          rbi: rbi,
          run_scored: runScored || baseReached === 4, // ホームインの場合は自動でtrue
          stolen_base: stolenBase,
          base_reached: baseReached,
          notes: notes || null,
        };

        // ゴロでランナーがいる場合、ダブルプレー選択画面を表示
        if (dbValue === "ゴロ") {
          // 現在のランナーを確認
          const { data: currentRunners } = await supabase
            .from("game_runners")
            .select("*")
            .eq("game_id", gameId)
            .eq("inning", currentInning)
            .eq("is_active", true)
            .in("current_base", [1, 2, 3]);

          if (currentRunners && currentRunners.length > 0) {
            // ダブルプレーの可能性がある
            setPendingBattingData(recordData);
            setShowDoublePlaySelector(true);
            setSaving(false);
            return; // ここで処理を中断し、ダブルプレー選択を待つ
          }
        }

        // 通常の記録保存
        const { error } = await supabase
          .from("game_batting_records")
          .insert(recordData);

        if (error) throw error;

        // 出塁した場合、ランナーとして登録
        if (!error && baseReached > 0 && baseReached < 4) {
          // まず既存のランナーを進塁させる
          await advanceRunners(baseReached, selectedPlayer.id);

          // 打者をランナーとして登録
          await supabase.from("game_runners").insert({
            game_id: gameId,
            inning: currentInning,
            player_id: selectedPlayer.id,
            player_name: selectedPlayer.player_name,
            current_base: baseReached,
            is_active: true,
          });
        } else if (!error && baseReached > 0) {
          // ホームインまたは出塁の場合も既存ランナーを進塁
          await advanceRunners(baseReached, selectedPlayer.id);
        }

        // アウトカウントを更新
        const newOuts = isOut ? currentOuts + 1 : currentOuts;
        setCurrentOuts(newOuts);

        // 保存成功メッセージ
        setMessage(
          newOuts >= 3 ? "スリーアウトチェンジ！" : "記録を保存しました"
        );

        // 3アウトの場合、イニング交代
        if (newOuts >= 3) {
          handleInningChange();
        }
      }

      resetForm();
      await fetchInningRecords();
      await updateGameScore();
      await calculateNextBatter();

      if (onRecordSaved) onRecordSaved();
    } catch (error) {
      console.error("保存エラー:", error);
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleInningChange = async () => {
    // ランナーをクリア
    await supabase
      .from("game_runners")
      .update({ is_active: false })
      .eq("game_id", gameId)
      .eq("inning", currentInning);

    setCurrentOuts(0);
    setIsInningLocked(false);

    if (currentInning >= MAX_INNINGS && isTopBottom === "bottom") {
      // 7回裏終了で試合終了
      if (onGameEnd) {
        onGameEnd();
      }
    } else if (onInningChange) {
      // 次のイニングへ
      const nextTopBottom = isTopBottom === "top" ? "bottom" : "top";
      const nextInning =
        isTopBottom === "bottom" ? currentInning + 1 : currentInning;
      onInningChange(nextInning, nextTopBottom);
    }
  };

  const updateGameScore = async () => {
    // 自チームの総得点を更新
    const { data: allRecords } = await supabase
      .from("game_batting_records")
      .select("*")
      .eq("game_id", gameId)
      .eq("run_scored", true);

    if (allRecords) {
      const totalRuns = allRecords.length;

      await supabase
        .from("games")
        .update({
          home_score: totalRuns,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);
    }
  };

  const handleEditRecord = (record: BattingRecord) => {
    setEditMode(true);
    setEditingRecord(record);
    const player = players.find((p) => p.id === record.player_id);
    if (player) {
      setSelectedPlayer(player);
    }
    // 英語の値に変換して設定
    const allResults = [
      ...BATTING_RESULTS.hits,
      ...BATTING_RESULTS.outs,
      ...BATTING_RESULTS.others,
    ];
    const englishResult = allResults.find((r) => r.dbValue === record.result);
    setBattingResult(englishResult?.value || "");
    setRbi(record.rbi);
    setRunScored(record.run_scored);
    setStolenBase(record.stolen_base || false);
    setBaseReached(record.base_reached || 0);
    setNotes(record.notes || "");
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm("この記録を削除しますか？")) return;

    try {
      // 削除する記録の詳細を取得
      const { data: recordToDelete } = await supabase
        .from("game_batting_records")
        .select("*")
        .eq("id", recordId)
        .single();

      if (recordToDelete) {
        // 記録を削除
        const { error } = await supabase
          .from("game_batting_records")
          .delete()
          .eq("id", recordId);

        if (error) throw error;

        // 関連するランナー記録も削除
        await supabase
          .from("game_runners")
          .delete()
          .eq("game_id", gameId)
          .eq("player_id", recordToDelete.player_id)
          .eq("inning", currentInning);

        // アウト数を再計算
        await fetchInningRecords();
        await updateGameScore();
        setMessage("記録を削除しました");
      }
    } catch (error) {
      console.error("削除エラー:", error);
      setMessage("削除に失敗しました");
    }
  };

  // 出塁する結果かどうかを判定
  const isOnBaseResult = ON_BASE_RESULTS.includes(
    BATTING_RESULTS.hits
      .concat(BATTING_RESULTS.outs)
      .concat(BATTING_RESULTS.others)
      .find((r) => r.value === battingResult)?.dbValue || ""
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          {currentInning}回{isTopBottom === "top" ? "表" : "裏"}の打撃入力
        </h3>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            アウト: <span className="font-bold text-lg">{currentOuts}</span> / 3
          </span>
          {isInningLocked && (
            <span className="text-red-600 font-semibold">イニング終了</span>
          )}
        </div>
      </div>

      {!isInningLocked && (
        <div className="space-y-4">
          {/* 選手選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              打者
            </label>
            <select
              value={selectedPlayer?.id || ""}
              onChange={(e) => {
                const player = players.find((p) => p.id === e.target.value);
                setSelectedPlayer(player || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={saving}
            >
              <option value="">選手を選択</option>
              {battingLineup.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.batting_order}番 - {player.player_name}
                </option>
              ))}
            </select>
          </div>

          {/* 打撃結果 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              打撃結果
            </label>
            <div className="space-y-2">
              {/* ヒット */}
              <div>
                <span className="text-sm text-gray-600">ヒット</span>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {BATTING_RESULTS.hits.map((result) => (
                    <button
                      key={result.value}
                      type="button"
                      onClick={() => {
                        setBattingResult(result.value);
                        // 本塁打の場合は自動的に本塁に設定
                        if (result.value === "homerun") {
                          setBaseReached(4);
                          setRunScored(true);
                        }
                      }}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        battingResult === result.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                      disabled={saving}
                    >
                      {result.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* アウト */}
              <div>
                <span className="text-sm text-gray-600">アウト</span>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {BATTING_RESULTS.outs.map((result) => (
                    <button
                      key={result.value}
                      type="button"
                      onClick={() => {
                        setBattingResult(result.value);
                        setBaseReached(0);
                      }}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        battingResult === result.value
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                      disabled={saving}
                    >
                      {result.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* その他 */}
              <div>
                <span className="text-sm text-gray-600">その他</span>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {BATTING_RESULTS.others.map((result) => (
                    <button
                      key={result.value}
                      type="button"
                      onClick={() => setBattingResult(result.value)}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        battingResult === result.value
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                      disabled={saving}
                    >
                      {result.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 到達塁選択（出塁時のみ表示） */}
          {isOnBaseResult && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                到達塁 <span className="text-red-500">*</span>
              </label>
              <select
                value={baseReached}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setBaseReached(value);
                  // ホームインの場合は得点フラグを自動設定
                  if (value === 4) {
                    setRunScored(true);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={saving || battingResult === "homerun"}
              >
                <option value={0}>選択してください</option>
                <option value={1}>一塁</option>
                <option value={2}>二塁</option>
                <option value={3}>三塁</option>
                <option value={4}>本塁（得点）</option>
              </select>
              {battingResult === "homerun" && (
                <p className="text-xs text-gray-500 mt-1">
                  本塁打のため自動的に本塁が選択されています
                </p>
              )}
            </div>
          )}

          {/* 打点 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              打点
            </label>
            <input
              type="number"
              min="0"
              max="4"
              value={rbi}
              onChange={(e) => setRbi(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={saving}
            />
          </div>

          {/* その他オプション */}
          <div className="flex space-x-4">
            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runScored}
                  onChange={(e) => setRunScored(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={saving || baseReached === 4}
                />
                <span className="text-sm font-medium text-gray-700">得点</span>
              </label>
            </div>
            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stolenBase}
                  onChange={(e) => setStolenBase(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={saving}
                />
                <span className="text-sm font-medium text-gray-700">盗塁</span>
              </label>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メモ（任意）
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例: センター前ヒット"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={saving}
            />
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end space-x-2">
            {editMode && (
              <button
                type="button"
                onClick={async () => {
                  resetForm();
                  await calculateNextBatter();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                disabled={saving}
              >
                キャンセル
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveRecord}
              disabled={
                saving ||
                !selectedPlayer ||
                !battingResult ||
                (isOnBaseResult && baseReached === 0)
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : editMode ? "更新" : "保存"}
            </button>
          </div>

          {/* メッセージ */}
          {message && (
            <div
              className={`text-center py-2 px-4 rounded-lg ${
                message.includes("失敗")
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      )}

      {/* イニングの記録 */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          {currentInning}回{isTopBottom === "top" ? "表" : "裏"}の記録
        </h4>
        {inningRecords.length === 0 ? (
          <p className="text-gray-500 text-sm">まだ記録がありません</p>
        ) : (
          <div className="space-y-2">
            {inningRecords.map((record, index) => {
              const player = players.find((p) => p.id === record.player_id);
              const isDoublePlay =
                record.notes?.includes("併殺（ダブルプレー）");
              const isTriplePlay =
                record.notes?.includes("三重殺（トリプルプレー）");

              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex-1">
                    <span className="font-medium">{index + 1}. </span>
                    <span>{player?.player_name}</span>
                    <span className="ml-2 text-sm text-gray-600">
                      {record.result}
                    </span>
                    {isDoublePlay && (
                      <span className="ml-2 text-sm font-bold text-red-600">
                        併殺(2アウト)
                      </span>
                    )}
                    {isTriplePlay && (
                      <span className="ml-2 text-sm font-bold text-red-600">
                        三重殺(3アウト)
                      </span>
                    )}
                    {record.rbi > 0 && (
                      <span className="ml-2 text-sm text-blue-600">
                        {record.rbi}打点
                      </span>
                    )}
                    {record.run_scored && (
                      <span className="ml-2 text-sm text-green-600">得点</span>
                    )}
                    {record.notes && !isDoublePlay && !isTriplePlay && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({record.notes})
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditRecord(record)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                      disabled={isInningLocked}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                      disabled={isInningLocked}
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ダブルプレー選択モーダル */}
      {showDoublePlaySelector && (
        <DoublePlaySelector
          gameId={gameId}
          currentInning={currentInning}
          onDoublePlaySelect={handleDoublePlay}
          onCancel={() => {
            setShowDoublePlaySelector(false);
            setPendingBattingData(null);
            setSaving(false);
          }}
        />
      )}
    </div>
  );
}
