"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface BattingStats {
  player_id: string;
  total_games: number;
  total_at_bats: number;
  total_hits: number;
  total_home_runs: number;
  total_doubles: number;
  total_triples: number;
  total_rbi: number;
  total_runs: number;
  total_walks: number;
  total_stolen_bases: number;
  batting_average: string;
  on_base_percentage: string;
  slugging_percentage: string;
  ops: string;
}

interface PitchingStats {
  player_id: string;
  total_games: number;
  total_innings: number;
  total_innings_display: string;
  total_hits_allowed: number;
  total_runs_allowed: number;
  total_earned_runs: number;
  total_strikeouts: number;
  total_walks: number;
  total_home_runs_allowed: number;
  total_wins: number;
  total_losses: number;
  total_saves: number;
  era: string;
  whip: string;
  k_per_nine: string;
  bb_per_nine: string;
  win_percentage: string;
}

interface PersonalStatsProps {
  userId: string;
}

export default function PersonalStats({ userId }: PersonalStatsProps) {
  const [battingStats, setBattingStats] = useState<BattingStats | null>(null);
  const [pitchingStats, setPitchingStats] = useState<PitchingStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"batting" | "pitching">("batting");
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [userId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // まず、ユーザーが所属するチームメンバーIDを取得
      const { data: teamMemberData, error: teamMemberError } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", userId);

      if (teamMemberError) {
        console.error("チームメンバー取得エラー:", teamMemberError);
        setLoading(false);
        return;
      }

      if (!teamMemberData || teamMemberData.length === 0) {
        setLoading(false);
        return;
      }

      const teamMemberIds = teamMemberData.map((tm) => tm.id);

      // team_member_idに基づいてgame_playersを取得
      const { data: gamePlayerData, error: gamePlayerError } = await supabase
        .from("game_players")
        .select("id")
        .in("team_member_id", teamMemberIds);

      if (gamePlayerError) {
        console.error("ゲームプレイヤー取得エラー:", gamePlayerError);
        setLoading(false);
        return;
      }

      if (!gamePlayerData || gamePlayerData.length === 0) {
        setLoading(false);
        return;
      }

      const gamePlayerIds = gamePlayerData.map((gp) => gp.id);

      // 打撃成績の集計
      const { data: battingData, error: battingError } = await supabase
        .from("player_batting_stats")
        .select("*")
        .in("player_id", gamePlayerIds);

      if (battingData && battingData.length > 0) {
        const stats = calculateBattingTotals(battingData);
        setBattingStats(stats);
      }

      // 投手成績の集計（直接game_pitching_recordsから取得）
      const { data: pitchingData, error: pitchingError } = await supabase
        .from("game_pitching_records")
        .select("*")
        .in("player_id", gamePlayerIds);

      if (pitchingData && pitchingData.length > 0) {
        const stats = calculatePitchingTotals(pitchingData);
        setPitchingStats(stats);
      }
    } catch (error) {
      console.error("成績取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBattingTotals = (data: any[]): BattingStats => {
    const totals = data.reduce(
      (acc, game) => ({
        total_games: acc.total_games + 1,
        total_at_bats: acc.total_at_bats + (game.at_bats || 0),
        total_hits: acc.total_hits + (game.hits || 0),
        total_home_runs: acc.total_home_runs + (game.home_runs || 0),
        total_doubles: acc.total_doubles + (game.doubles || 0),
        total_triples: acc.total_triples + (game.triples || 0),
        total_rbi: acc.total_rbi + (game.rbi || 0),
        total_runs: acc.total_runs + (game.runs || 0),
        total_walks: acc.total_walks + (game.walks || 0),
        total_stolen_bases: acc.total_stolen_bases + (game.stolen_bases || 0),
      }),
      {
        total_games: 0,
        total_at_bats: 0,
        total_hits: 0,
        total_home_runs: 0,
        total_doubles: 0,
        total_triples: 0,
        total_rbi: 0,
        total_runs: 0,
        total_walks: 0,
        total_stolen_bases: 0,
      }
    );

    // 打率計算
    const avg =
      totals.total_at_bats > 0
        ? (totals.total_hits / totals.total_at_bats).toFixed(3)
        : ".000";

    // 出塁率計算
    const plateAppearances = totals.total_at_bats + totals.total_walks;
    const obp =
      plateAppearances > 0
        ? ((totals.total_hits + totals.total_walks) / plateAppearances).toFixed(
            3
          )
        : ".000";

    // 長打率計算
    const totalBases =
      totals.total_hits +
      totals.total_doubles +
      totals.total_triples * 2 +
      totals.total_home_runs * 3;
    const slg =
      totals.total_at_bats > 0
        ? (totalBases / totals.total_at_bats).toFixed(3)
        : ".000";

    // OPS計算
    const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);

    return {
      player_id: userId,
      ...totals,
      batting_average: avg,
      on_base_percentage: obp,
      slugging_percentage: slg,
      ops: ops,
    };
  };

  const calculatePitchingTotals = (data: any[]): PitchingStats => {
    console.log("取得した投手データ:", data);
    console.log("最初のゲームデータ:", data[0]);
    const totals = data.reduce(
      (acc, game) => ({
        total_games: acc.total_games + 1,
        total_innings: acc.total_innings + (game.innings_pitched || 0),
        total_hits_allowed: acc.total_hits_allowed + (game.hits_allowed || 0),
        total_runs_allowed: acc.total_runs_allowed + (game.runs_allowed || 0),
        total_earned_runs: acc.total_earned_runs + (game.earned_runs || 0),
        total_strikeouts: acc.total_strikeouts + (game.strikeouts || 0),
        total_walks: acc.total_walks + (game.walks || 0),
        total_home_runs_allowed:
          acc.total_home_runs_allowed + (game.home_runs_allowed || 0),
        total_wins: acc.total_wins + (game.win ? 1 : 0),
        total_losses: acc.total_losses + (game.loss ? 1 : 0),
        total_saves: acc.total_saves + (game.save ? 1 : 0),
      }),
      {
        total_games: 0,
        total_innings: 0,
        total_hits_allowed: 0,
        total_runs_allowed: 0,
        total_earned_runs: 0,
        total_strikeouts: 0,
        total_walks: 0,
        total_home_runs_allowed: 0,
        total_wins: 0,
        total_losses: 0,
        total_saves: 0,
      }
    );

    // 投球回の表示形式変換
    const inningsDisplay = formatInnings(totals.total_innings);

    // 実際のイニング数に変換（計算用）
    const actualInnings =
      Math.floor(totals.total_innings) + ((totals.total_innings % 1) * 10) / 3;

    // 防御率計算（7回換算）
    const era =
      actualInnings > 0
        ? ((totals.total_earned_runs * 7) / actualInnings).toFixed(2)
        : "0.00";

    // WHIP計算
    const whip =
      actualInnings > 0
        ? (
            (totals.total_walks + totals.total_hits_allowed) /
            actualInnings
          ).toFixed(2)
        : "0.00";

    // K/7計算（7回換算）
    const kPerNine =
      actualInnings > 0
        ? ((totals.total_strikeouts * 7) / actualInnings).toFixed(2)
        : "0.00";

    // BB/7計算（7回換算）
    const bbPerNine =
      actualInnings > 0
        ? ((totals.total_walks * 7) / actualInnings).toFixed(2)
        : "0.00";

    // 勝率計算を追加
    const decisions = totals.total_wins + totals.total_losses;
    const winPercentage =
      decisions > 0
        ? ((totals.total_wins / decisions) * 100).toFixed(1)
        : "0.0";

    return {
      player_id: userId,
      ...totals,
      total_innings_display: inningsDisplay,
      era: era,
      whip: whip,
      k_per_nine: kPerNine,
      bb_per_nine: bbPerNine,
      win_percentage: winPercentage,
    };
  };

  const formatInnings = (innings: number): string => {
    const wholeInnings = Math.floor(innings);
    const outs = Math.round((innings % 1) * 10);

    if (outs === 0) return `${wholeInnings}.0`;
    if (outs === 1) return `${wholeInnings}.1`;
    if (outs === 2) return `${wholeInnings}.2`;
    return `${wholeInnings}.0`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!battingStats && !pitchingStats) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">個人成績</h3>
        <p className="text-gray-500 text-center py-8">
          まだ成績データがありません
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow mb-8">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">個人成績</h3>
      </div>

      {/* タブ */}
      <div className="border-b">
        <div className="flex">
          {battingStats && (
            <button
              onClick={() => setActiveTab("batting")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "batting"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              打撃成績
            </button>
          )}
          {pitchingStats && (
            <button
              onClick={() => setActiveTab("pitching")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pitching"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              投手成績
            </button>
          )}
        </div>
      </div>

      {/* 成績内容 */}
      <div className="p-6">
        {activeTab === "batting" && battingStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-gray-500">試合数</dt>
              <dd className="text-xl font-semibold">
                {battingStats.total_games}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">打率</dt>
              <dd className="text-xl font-semibold">
                {battingStats.batting_average}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">本塁打</dt>
              <dd className="text-xl font-semibold">
                {battingStats.total_home_runs}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">打点</dt>
              <dd className="text-xl font-semibold">
                {battingStats.total_rbi}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">安打</dt>
              <dd className="text-xl font-semibold">
                {battingStats.total_hits}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">得点</dt>
              <dd className="text-xl font-semibold">
                {battingStats.total_runs}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">盗塁</dt>
              <dd className="text-xl font-semibold">
                {battingStats.total_stolen_bases}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">OPS</dt>
              <dd className="text-xl font-semibold">{battingStats.ops}</dd>
            </div>
          </div>
        )}

        {activeTab === "pitching" && pitchingStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-gray-500">登板数</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.total_games}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">投球回</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.total_innings_display}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">防御率</dt>
              <dd className="text-xl font-semibold">{pitchingStats.era}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">奪三振</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.total_strikeouts}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">WHIP</dt>
              <dd className="text-xl font-semibold">{pitchingStats.whip}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">K/7</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.k_per_nine}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">BB/7</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.bb_per_nine}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">被安打</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.total_hits_allowed}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">勝敗</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.total_wins}-{pitchingStats.total_losses}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">セーブ</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.total_saves}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">勝率</dt>
              <dd className="text-xl font-semibold">
                {pitchingStats.win_percentage}%
              </dd>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
