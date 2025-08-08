import { Headline1 } from "@/components/Headline1";
import React from "react";

// 型定義
interface TeamScore {
  id: string;
  name: string;
  isHome: boolean;
  scores: (number | null)[]; // nullは未プレイのイニング
  totalScore: number;
  hits?: number; // H（安打数）
  errors?: number; // E（エラー数）
}

interface GameDetail {
  id: string;
  date: string;
  gameRule: string;
  gameCategory: string;
  gameStage: string;
  ballpark: string;
  status: "scheduled" | "in_progress" | "completed" | "postponed";
  teams: TeamScore[];
  createdAt?: string;
  updatedAt?: string;
}

// カスタムフック（後でSupabaseとの連携時に使用）
// const useGameDetail = (gameId: string) => {
//   // Supabaseからのデータ取得ロジック
// };

export default function GameDetailPage() {
  // 実際の使用時はuseGameDetailフックなどでデータを取得
  const gameDetail: GameDetail = {
    id: "game_001",
    date: "2025年7月26日",
    gameRule: "公式戦",
    gameCategory: "GBNリーグ",
    gameStage: "4回戦",
    ballpark: "夢の島公園野球場",
    status: "completed",
    teams: [
      {
        id: "team_exodus",
        name: "EXODUS",
        isHome: false,
        scores: [0, 0, 0, 0, 2, 0, 3],
        totalScore: 5,
        hits: 8,
        errors: 1,
      },
      {
        id: "team_darks",
        name: "ダークス",
        isHome: true,
        scores: [0, 1, 1, 3, 0, 2, null], // 7回裏は攻撃なし
        totalScore: 7,
        hits: 10,
        errors: 0,
      },
    ],
  };

  // ユーティリティ関数
  const getMaxInnings = (teams: TeamScore[]): number => {
    return Math.max(...teams.map((team) => team.scores.length));
  };

  const renderScore = (score: number | null): string => {
    if (score === null || score === undefined) return "X";
    return score.toString();
  };

  const getWinningTeam = (teams: TeamScore[]): TeamScore | null => {
    if (teams.length < 2) return null;
    return teams.reduce((prev, current) =>
      prev.totalScore > current.totalScore ? prev : current
    );
  };

  const getGameStatusText = (status: GameDetail["status"]): string => {
    switch (status) {
      case "scheduled":
        return "予定";
      case "in_progress":
        return "試合中";
      case "completed":
        return "試合終了";
      case "postponed":
        return "延期";
      default:
        return "";
    }
  };

  const maxInnings = getMaxInnings(gameDetail.teams);
  const inningHeaders = Array.from({ length: maxInnings }, (_, i) => i + 1);
  const winningTeam = getWinningTeam(gameDetail.teams);

  return (
    <>
      <Headline1>試合詳細</Headline1>
      <div className="max-w-6xl mx-auto p-4">
        {/* 試合情報セクション */}
        <section className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-semibold text-gray-800">
                {gameDetail.date}
              </div>
              <div className="text-sm text-gray-600">{gameDetail.gameRule}</div>
              <div className="text-sm text-gray-600">
                {gameDetail.gameCategory} {gameDetail.gameStage}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">{gameDetail.ballpark}</div>
              <div className="text-sm font-semibold text-blue-600">
                {getGameStatusText(gameDetail.status)}
              </div>
            </div>
          </div>
        </section>

        {/* スコアテーブル */}
        <div className="overflow-x-auto shadow-lg rounded-lg">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-3 text-left font-semibold">
                  チーム名
                </th>
                {inningHeaders.map((inning) => (
                  <th
                    key={inning}
                    className="border border-gray-300 px-2 py-3 text-center font-semibold min-w-[40px]"
                  >
                    {inning}
                  </th>
                ))}
                <th className="border border-gray-300 px-3 py-3 text-center font-bold bg-yellow-100">
                  R
                </th>
                <th className="border border-gray-300 px-3 py-3 text-center font-semibold">
                  H
                </th>
                <th className="border border-gray-300 px-3 py-3 text-center font-semibold">
                  E
                </th>
              </tr>
            </thead>
            <tbody>
              {gameDetail.teams.map((team) => (
                <tr
                  key={team.id}
                  className={`${
                    team.isHome ? "bg-blue-50" : "bg-red-50"
                  } hover:bg-opacity-70`}
                >
                  <th className="border border-gray-300 px-3 py-3 text-left font-semibold">
                    <div>
                      {team.name}
                      <span className="text-xs text-gray-500 ml-2">
                        {team.isHome ? "(後攻)" : "(先攻)"}
                      </span>
                    </div>
                  </th>
                  {inningHeaders.map((inning) => {
                    const scoreIndex = inning - 1;
                    const score = team.scores[scoreIndex];
                    return (
                      <td
                        key={inning}
                        className="border border-gray-300 px-2 py-3 text-center"
                      >
                        <span
                          className={
                            score && score > 0
                              ? "font-semibold text-blue-600"
                              : ""
                          }
                        >
                          {renderScore(score)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 px-3 py-3 text-center font-bold text-lg bg-yellow-50">
                    {team.totalScore}
                  </td>
                  <td className="border border-gray-300 px-3 py-3 text-center">
                    {team.hits || 0}
                  </td>
                  <td className="border border-gray-300 px-3 py-3 text-center">
                    {team.errors || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 試合結果 */}
        {gameDetail.status === "completed" && winningTeam && (
          <div className="mt-6 text-center bg-green-50 p-4 rounded-lg">
            <div className="text-xl font-bold text-green-800">
              🏆 {winningTeam.name} の勝利
            </div>
            <div className="text-sm text-gray-600 mt-1">
              最終スコア:{" "}
              {gameDetail.teams
                .map((t) => `${t.name} ${t.totalScore}`)
                .join(" - ")}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Supabase用のテーブル設計例（参考）
/*
-- games テーブル
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  game_rule TEXT NOT NULL,
  game_category TEXT NOT NULL,
  game_stage TEXT NOT NULL,
  ballpark TEXT NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'postponed')) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- teams テーブル
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- game_teams テーブル（試合とチームの中間テーブル）
CREATE TABLE game_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  is_home BOOLEAN NOT NULL,
  total_score INTEGER DEFAULT 0,
  hits INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- inning_scores テーブル（イニング毎のスコア）
CREATE TABLE inning_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_team_id UUID REFERENCES game_teams(id) ON DELETE CASCADE,
  inning INTEGER NOT NULL,
  score INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_team_id, inning)
);
*/
