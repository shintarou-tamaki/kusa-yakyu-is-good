"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Save, Trophy, Edit2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface PitchingRecord {
  id?: string;
  game_id: string;
  player_id: string;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  strikeouts: number;
  walks: number;
  home_runs_allowed: number;
  win?: boolean;
  loss?: boolean;
  save?: boolean;
}

interface Props {
  gameId: string;
  players: GamePlayer[];
  canEdit: boolean;
  onRecordSaved?: () => void;
}

export default function PitchingRecordInput({
  gameId,
  players,
  canEdit,
  onRecordSaved,
}: Props) {
  const supabase = createClientComponentClient();

  const [selectedPitcher, setSelectedPitcher] = useState<string>("");
  const [pitchingData, setPitchingData] = useState<
    Omit<PitchingRecord, "id" | "game_id" | "player_id">
  >({
    innings_pitched: 0,
    hits_allowed: 0,
    runs_allowed: 0,
    earned_runs: 0,
    strikeouts: 0,
    walks: 0,
    home_runs_allowed: 0,
    win: false,
    loss: false,
    save: false,
  });
  const [existingRecords, setExistingRecords] = useState<PitchingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 投手候補を取得（投手またはDHポジションの選手）
  const pitcherCandidates = players;

  useEffect(() => {
    fetchExistingRecords();
  }, [gameId]);

  const fetchExistingRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("game_pitching_records")
        .select("*")
        .eq("game_id", gameId);

      if (error) throw error;
      if (data) {
        setExistingRecords(data);
      }
    } catch (error) {
      console.error("投手記録取得エラー:", error);
    }
  };

  const handleInningsPitchedChange = (value: string) => {
    const floatValue = parseFloat(value);
    if (isNaN(floatValue) || floatValue < 0) return;

    // 整数部分と小数部分を分離
    const wholeInnings = Math.floor(floatValue);
    const outs = Math.round((floatValue - wholeInnings) * 10);

    // 3アウト以上は次のイニングに繰り上げ
    const adjustedInnings = wholeInnings + Math.floor(outs / 3);
    const adjustedOuts = outs % 3;

    // 0.1刻みの形式に変換（0.3は1.0になる）
    const finalValue = adjustedInnings + adjustedOuts / 10;

    setPitchingData((prev) => ({ ...prev, innings_pitched: finalValue }));
  };

  const handleSave = async () => {
    if (!selectedPitcher) {
      setMessage({ type: "error", text: "投手を選択してください" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const recordData = {
        game_id: gameId,
        player_id: selectedPitcher,
        ...pitchingData,
      };

      if (editingRecord) {
        // 更新
        const { error } = await supabase
          .from("game_pitching_records")
          .update(recordData)
          .eq("id", editingRecord);

        if (error) throw error;
        setMessage({ type: "success", text: "投手記録を更新しました" });
        setEditingRecord(null);
      } else {
        // 新規作成
        const { error } = await supabase
          .from("game_pitching_records")
          .insert(recordData);

        if (error) throw error;
        setMessage({ type: "success", text: "投手記録を保存しました" });
      }

      // リセット
      setSelectedPitcher("");
      setPitchingData({
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        strikeouts: 0,
        walks: 0,
        home_runs_allowed: 0,
        win: false,
        loss: false,
        save: false,
      });

      await fetchExistingRecords();
      if (onRecordSaved) onRecordSaved();
    } catch (error) {
      console.error("保存エラー:", error);
      setMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: PitchingRecord) => {
    setEditingRecord(record.id || null);
    setSelectedPitcher(record.player_id);
    setPitchingData({
      innings_pitched: record.innings_pitched,
      hits_allowed: record.hits_allowed,
      runs_allowed: record.runs_allowed,
      earned_runs: record.earned_runs,
      strikeouts: record.strikeouts,
      walks: record.walks,
      home_runs_allowed: record.home_runs_allowed,
      win: record.win || false,
      loss: record.loss || false,
      save: record.save || false,
    });
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("この投手記録を削除しますか？")) return;

    try {
      const { error } = await supabase
        .from("game_pitching_records")
        .delete()
        .eq("id", recordId);

      if (error) throw error;

      setMessage({ type: "success", text: "投手記録を削除しました" });
      await fetchExistingRecords();
      if (onRecordSaved) onRecordSaved();
    } catch (error) {
      console.error("削除エラー:", error);
      setMessage({ type: "error", text: "削除に失敗しました" });
    }
  };

  const formatInningsPitched = (innings: number) => {
    // 小数点第一位まで表示（0.1=1アウト、0.2=2アウト）
    if (innings % 1 === 0) {
      return `${innings}`;
    }
    return innings.toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          投手記録
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* 既存記録の表示 */}
        {existingRecords.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="font-medium">登録済み投手記録</h4>
            {existingRecords.map((record) => {
              const player = players.find((p) => p.id === record.player_id);
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="text-sm">
                    <span className="font-medium">{player?.player_name}</span>
                    <span className="ml-2 text-gray-600">
                      {formatInningsPitched(record.innings_pitched)}回 被安打
                      {record.hits_allowed} 失点{record.runs_allowed}
                      自責{record.earned_runs} 奪三振{record.strikeouts}
                      {record.win && (
                        <span className="ml-2 font-semibold text-green-600">
                          勝
                        </span>
                      )}
                      {record.loss && (
                        <span className="ml-2 font-semibold text-red-600">
                          負
                        </span>
                      )}
                      {record.save && (
                        <span className="ml-2 font-semibold text-blue-600">
                          S
                        </span>
                      )}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(record)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(record.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        削除
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <>
            {/* 投手選択 */}
            <div>
              <Label htmlFor="pitcher">投手</Label>
              <Select
                value={selectedPitcher}
                onValueChange={setSelectedPitcher}
              >
                <SelectTrigger>
                  <SelectValue placeholder="投手を選択" />
                </SelectTrigger>
                <SelectContent>
                  {pitcherCandidates.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.player_name} ({player.position})
                    </SelectItem>
                  ))}
                  {pitcherCandidates.length === 0 && (
                    <SelectItem value="none" disabled>
                      投手がいません
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 成績入力フォーム */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="innings">投球回</Label>
                <Input
                  id="innings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={pitchingData.innings_pitched}
                  onChange={(e) => handleInningsPitchedChange(e.target.value)}
                  placeholder="0.0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  小数点以下: .1=1アウト、.2=2アウト（3アウトで次の回へ）
                </p>
              </div>
              <div>
                <Label htmlFor="hits">被安打</Label>
                <Input
                  id="hits"
                  type="number"
                  min="0"
                  value={pitchingData.hits_allowed}
                  onChange={(e) =>
                    setPitchingData((prev) => ({
                      ...prev,
                      hits_allowed: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="runs">失点</Label>
                <Input
                  id="runs"
                  type="number"
                  min="0"
                  value={pitchingData.runs_allowed}
                  onChange={(e) =>
                    setPitchingData((prev) => ({
                      ...prev,
                      runs_allowed: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="earned_runs">自責点</Label>
                <Input
                  id="earned_runs"
                  type="number"
                  min="0"
                  value={pitchingData.earned_runs}
                  onChange={(e) =>
                    setPitchingData((prev) => ({
                      ...prev,
                      earned_runs: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="strikeouts">奪三振</Label>
                <Input
                  id="strikeouts"
                  type="number"
                  min="0"
                  value={pitchingData.strikeouts}
                  onChange={(e) =>
                    setPitchingData((prev) => ({
                      ...prev,
                      strikeouts: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="walks">与四球</Label>
                <Input
                  id="walks"
                  type="number"
                  min="0"
                  value={pitchingData.walks}
                  onChange={(e) =>
                    setPitchingData((prev) => ({
                      ...prev,
                      walks: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="home_runs">被本塁打</Label>
                <Input
                  id="home_runs"
                  type="number"
                  min="0"
                  value={pitchingData.home_runs_allowed}
                  onChange={(e) =>
                    setPitchingData((prev) => ({
                      ...prev,
                      home_runs_allowed: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {/* 勝敗・セーブ選択UI（追加） */}
            <div className="mt-4">
              <Label>勝敗・セーブ</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pitching_result"
                    checked={
                      !pitchingData.win &&
                      !pitchingData.loss &&
                      !pitchingData.save
                    }
                    onChange={() =>
                      setPitchingData((prev) => ({
                        ...prev,
                        win: false,
                        loss: false,
                        save: false,
                      }))
                    }
                    className="mr-2"
                  />
                  －
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pitching_result"
                    checked={pitchingData.win}
                    onChange={() =>
                      setPitchingData((prev) => ({
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
                    checked={pitchingData.loss}
                    onChange={() =>
                      setPitchingData((prev) => ({
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
                    checked={pitchingData.save}
                    onChange={() =>
                      setPitchingData((prev) => ({
                        ...prev,
                        win: false,
                        loss: false,
                        save: true,
                      }))
                    }
                    className="mr-2"
                  />
                  S
                </label>
              </div>
            </div>

            {/* 保存ボタン */}
            <Button
              onClick={handleSave}
              disabled={loading || !selectedPitcher}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {editingRecord ? "更新" : "保存"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
