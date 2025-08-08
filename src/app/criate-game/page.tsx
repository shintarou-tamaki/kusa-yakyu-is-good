"use client";

import { Headline1 } from "@/components/Headline1";
import React, { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

interface CreateGameForm {
  gameDate: string;
  gameTime: string;
  gameCategory: "practice" | "official";
  gameName: string;
  groundName: string;
  opponentTeam: string;
  battingOrder: "first" | "second"; // 先攻 or 後攻
  myTeam: string; // 自分のチーム名
}

interface Team {
  id: string;
  name: string;
}

export default function CreateGamePage() {
  const [formData, setFormData] = useState<CreateGameForm>({
    gameDate: "",
    gameTime: "",
    gameCategory: "practice",
    gameName: "",
    groundName: "",
    opponentTeam: "",
    battingOrder: "first",
    myTeam: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [existingTeams, setExistingTeams] = useState<Team[]>([]);
  const [showNewTeamInput, setShowNewTeamInput] = useState(false);

  const router = useRouter();
  const supabase = createClientComponentClient();

  // 既存チームの取得
  React.useEffect(() => {
    const fetchTeams = async () => {
      if (!supabase) return;

      try {
        const { data: teams, error } = await supabase
          .from("teams")
          .select("*")
          .order("name");

        if (error) throw error;
        if (teams) {
          setExistingTeams(teams);
        }
      } catch (err) {
        console.error("チーム取得エラー:", err);
      }
    };

    fetchTeams();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!supabase) {
        throw new Error("Supabaseに接続できません");
      }

      // バリデーション
      if (
        !formData.gameDate ||
        !formData.gameName ||
        !formData.groundName ||
        !formData.opponentTeam ||
        !formData.myTeam
      ) {
        throw new Error("すべての必須項目を入力してください");
      }

      // 1. 自分のチームを作成または取得
      let myTeamId = "";
      const existingMyTeam = existingTeams.find(
        (team) => team.name === formData.myTeam
      );

      if (existingMyTeam) {
        myTeamId = existingMyTeam.id;
      } else {
        const { data: newMyTeam, error: myTeamError } = await supabase
          .from("teams")
          .insert({ name: formData.myTeam })
          .select()
          .single();

        if (myTeamError) throw myTeamError;
        myTeamId = newMyTeam.id;
      }

      // 2. 対戦相手チームを作成または取得
      let opponentTeamId = "";
      const existingOpponentTeam = existingTeams.find(
        (team) => team.name === formData.opponentTeam
      );

      if (existingOpponentTeam) {
        opponentTeamId = existingOpponentTeam.id;
      } else {
        const { data: newOpponentTeam, error: opponentTeamError } =
          await supabase
            .from("teams")
            .insert({ name: formData.opponentTeam })
            .select()
            .single();

        if (opponentTeamError) throw opponentTeamError;
        opponentTeamId = newOpponentTeam.id;
      }

      // 3. 試合を作成
      const gameDateTime = `${formData.gameDate}${
        formData.gameTime ? ` ${formData.gameTime}` : ""
      }`;

      const { data: newGame, error: gameError } = await supabase
        .from("games")
        .insert({
          date: formData.gameDate,
          game_rule:
            formData.gameCategory === "official" ? "公式戦" : "練習試合",
          game_category: formData.gameName,
          game_stage: "", // 必要に応じて後で追加
          ballpark: formData.groundName,
          status: "scheduled",
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // 4. ゲーム-チーム関連を作成
      const gameTeams = [
        {
          game_id: newGame.id,
          team_id: myTeamId,
          is_home: formData.battingOrder === "second", // 後攻がホーム
          total_score: 0,
          hits: 0,
          errors: 0,
        },
        {
          game_id: newGame.id,
          team_id: opponentTeamId,
          is_home: formData.battingOrder === "first", // 先攻の場合、相手がホーム
          total_score: 0,
          hits: 0,
          errors: 0,
        },
      ];

      const { error: gameTeamsError } = await supabase
        .from("game_teams")
        .insert(gameTeams);

      if (gameTeamsError) throw gameTeamsError;

      // 5. スコア入力画面に遷移
      router.push(`/game-score/${newGame.id}`);
    } catch (err: any) {
      setError(err.message || "試合の作成中にエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryDisplayName = (category: string) => {
    return category === "official" ? "公式戦" : "練習試合";
  };

  const getBattingOrderDisplayName = (order: string) => {
    return order === "first" ? "先攻" : "後攻";
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Headline1>新しい試合を作成</Headline1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* 試合日時 */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="gameDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              試合日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="gameDate"
              name="gameDate"
              value={formData.gameDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="gameTime"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              試合開始時刻 (任意)
            </label>
            <input
              type="time"
              id="gameTime"
              name="gameTime"
              value={formData.gameTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 試合カテゴリー */}
        <div>
          <label
            htmlFor="gameCategory"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            試合カテゴリー <span className="text-red-500">*</span>
          </label>
          <select
            id="gameCategory"
            name="gameCategory"
            value={formData.gameCategory}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="practice">練習試合</option>
            <option value="official">公式戦</option>
          </select>
        </div>

        {/* 試合名 */}
        <div>
          <label
            htmlFor="gameName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            試合名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="gameName"
            name="gameName"
            value={formData.gameName}
            onChange={handleInputChange}
            placeholder="例：〇〇カップ、定期戦など"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* グラウンド名 */}
        <div>
          <label
            htmlFor="groundName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            グラウンド名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="groundName"
            name="groundName"
            value={formData.groundName}
            onChange={handleInputChange}
            placeholder="例：夢の島公園野球場"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 自分のチーム名 */}
        <div>
          <label
            htmlFor="myTeam"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            自分のチーム名 <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            <select
              id="myTeam"
              name="myTeam"
              value={formData.myTeam}
              onChange={(e) => {
                if (e.target.value === "new_team") {
                  setShowNewTeamInput(true);
                  setFormData((prev) => ({ ...prev, myTeam: "" }));
                } else {
                  setShowNewTeamInput(false);
                  handleInputChange(e);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">チームを選択してください</option>
              {existingTeams.map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))}
              <option value="new_team">+ 新しいチームを追加</option>
            </select>

            {showNewTeamInput && (
              <input
                type="text"
                name="myTeam"
                value={formData.myTeam}
                onChange={handleInputChange}
                placeholder="新しいチーム名を入力"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        </div>

        {/* 対戦相手 */}
        <div>
          <label
            htmlFor="opponentTeam"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            対戦相手 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="opponentTeam"
            name="opponentTeam"
            value={formData.opponentTeam}
            onChange={handleInputChange}
            placeholder="対戦相手チーム名"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 先攻後攻 */}
        <div>
          <label
            htmlFor="battingOrder"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            自チームの攻撃順 <span className="text-red-500">*</span>
          </label>
          <select
            id="battingOrder"
            name="battingOrder"
            value={formData.battingOrder}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="first">先攻</option>
            <option value="second">後攻</option>
          </select>
        </div>

        {/* 確認セクション */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            入力内容の確認
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">試合日:</span> {formData.gameDate}
              {formData.gameTime && ` ${formData.gameTime}`}
            </p>
            <p>
              <span className="font-medium">カテゴリー:</span>{" "}
              {getCategoryDisplayName(formData.gameCategory)}
            </p>
            <p>
              <span className="font-medium">試合名:</span>{" "}
              {formData.gameName || "未入力"}
            </p>
            <p>
              <span className="font-medium">グラウンド:</span>{" "}
              {formData.groundName || "未入力"}
            </p>
            <p>
              <span className="font-medium">対戦:</span>{" "}
              {formData.myTeam || "未入力"} vs{" "}
              {formData.opponentTeam || "未入力"}
            </p>
            <p>
              <span className="font-medium">攻撃順:</span>{" "}
              {formData.myTeam || "自チーム"}が
              {getBattingOrderDisplayName(formData.battingOrder)}
            </p>
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            戻る
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "作成中..." : "試合を作成してスコア入力へ"}
          </button>
        </div>
      </form>
    </div>
  );
}
