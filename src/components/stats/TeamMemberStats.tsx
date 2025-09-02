"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface MemberBattingStats {
  member_id: string;
  member_name: string;
  games: number;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  rbi: number;
  runs: number;
  walks: number;
  stolen_bases: number;
  batting_average: string;
  on_base_percentage: string;
  slugging_percentage: string;
  ops: string;
}

interface MemberPitchingStats {
  member_id: string;
  member_name: string;
  games: number;
  innings_pitched: number;
  innings_display: string;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  strikeouts: number;
  walks: number;
  home_runs_allowed: number;
  wins: number;
  losses: number;
  saves: number;
  era: string;
  whip: string;
  k_per_nine: string;
  bb_per_nine: string;
  win_percentage: string;
}

interface TeamMemberStatsProps {
  teamId: string;
}

export default function TeamMemberStats({ teamId }: TeamMemberStatsProps) {
  const [battingStats, setBattingStats] = useState<MemberBattingStats[]>([]);
  const [pitchingStats, setPitchingStats] = useState<MemberPitchingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"batting" | "pitching">("batting");
  const [sortField, setSortField] = useState<string>("batting_average");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (teamId) {
      fetchTeamStats();
    }
  }, [teamId]);

  const fetchTeamStats = async () => {
    setLoading(true);
    try {
      // チームメンバーを取得
      const { data: teamMembers, error: memberError } = await supabase
        .from("team_members")
        .select("id, user_id")
        .eq("team_id", teamId);

      if (memberError || !teamMembers) {
        console.error("チームメンバー取得エラー:", memberError);
        setLoading(false);
        return;
      }

      console.log("チームメンバー:", teamMembers);

      // 各メンバーの表示名を取得
      const userIds = teamMembers.map((m) => m.user_id);
      const { data: userProfiles } = await supabase
        .from("user_profiles")
        .select("id, display_name")
        .in("id", userIds);

      const userProfileMap = new Map(
        userProfiles?.map((p) => [p.id, p.display_name]) || []
      );

      // 各メンバーのgame_player IDを取得
      const memberGamePlayerMap = new Map<
        string,
        { ids: string[]; name: string }
      >();

      for (const member of teamMembers) {
        // このチームメンバーに関連するすべてのgame_playersを取得
        const { data: gamePlayerData } = await supabase
          .from("game_players")
          .select("id, player_name")
          .eq("team_member_id", member.id);

        if (gamePlayerData && gamePlayerData.length > 0) {
          // 表示名の優先順位: user_profiles.display_name > game_players.player_name > "名前未設定"
          const displayName =
            userProfileMap.get(member.user_id) ||
            gamePlayerData[0].player_name ||
            "名前未設定";

          memberGamePlayerMap.set(member.id, {
            ids: gamePlayerData.map((gp) => gp.id),
            name: displayName,
          });

          console.log(
            `メンバー ${displayName}: game_player IDs:`,
            gamePlayerData.map((gp) => gp.id)
          );
        }
      }

      console.log("memberGamePlayerMap:", memberGamePlayerMap);

      // また、チームの試合からgame_playersを直接取得（team_member_idがnullの場合も考慮）
      const { data: teamGames } = await supabase
        .from("games")
        .select("id")
        .eq("home_team_id", teamId);

      if (teamGames && teamGames.length > 0) {
        const gameIds = teamGames.map((g) => g.id);
        console.log("チームの試合ID:", gameIds);

        // これらの試合に参加した全プレイヤーを取得
        const { data: allGamePlayers } = await supabase
          .from("game_players")
          .select("id, player_name, team_member_id")
          .in("game_id", gameIds);

        console.log("すべてのゲームプレイヤー:", allGamePlayers);

        // team_member_idがnullのプレイヤーも名前でグループ化
        if (allGamePlayers) {
          const playerNameMap = new Map<string, string[]>();

          for (const gp of allGamePlayers) {
            if (!gp.team_member_id) {
              // team_member_idがない場合は名前でグループ化
              const existing = playerNameMap.get(gp.player_name) || [];
              existing.push(gp.id);
              playerNameMap.set(gp.player_name, existing);
            }
          }

          // 名前でグループ化されたプレイヤーもmemberGamePlayerMapに追加
          for (const [playerName, gpIds] of playerNameMap) {
            // 既存のマップに含まれていない場合のみ追加
            const exists = Array.from(memberGamePlayerMap.values()).some(
              (v) => v.name === playerName
            );

            if (!exists && gpIds.length > 0) {
              const pseudoId = `name_${playerName}`;
              memberGamePlayerMap.set(pseudoId, {
                ids: gpIds,
                name: playerName,
              });
              console.log(`名前ベースで追加: ${playerName}:`, gpIds);
            }
          }
        }
      }

      // 打撃成績を集計
      const battingStatsList: MemberBattingStats[] = [];

      for (const [memberId, playerInfo] of memberGamePlayerMap) {
        const { data: battingData, error: battingError } = await supabase
          .from("player_batting_stats")
          .select("*")
          .in("player_id", playerInfo.ids);

        console.log(`メンバー ${playerInfo.name} の打撃データ:`, battingData);
        if (battingError) {
          console.error("打撃データ取得エラー:", battingError);
        }

        if (battingData && battingData.length > 0) {
          const stats = calculateMemberBattingTotals(
            memberId,
            playerInfo.name,
            battingData
          );
          battingStatsList.push(stats);
        }
      }

      // 投手成績を集計
      const pitchingStatsList: MemberPitchingStats[] = [];

      for (const [memberId, playerInfo] of memberGamePlayerMap) {
        const { data: pitchingData, error: pitchingError } = await supabase
          .from("player_pitching_stats")
          .select("*")
          .in("player_id", playerInfo.ids);

        console.log(`メンバー ${playerInfo.name} の投手データ:`, pitchingData);
        if (pitchingError) {
          console.error("投手データ取得エラー:", pitchingError);
        }

        if (pitchingData && pitchingData.length > 0) {
          const stats = calculateMemberPitchingTotals(
            memberId,
            playerInfo.name,
            pitchingData
          );
          pitchingStatsList.push(stats);
        }
      }

      console.log("打撃成績リスト:", battingStatsList);
      console.log("投手成績リスト:", pitchingStatsList);

      setBattingStats(battingStatsList);
      setPitchingStats(pitchingStatsList);
    } catch (error) {
      console.error("成績取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMemberBattingTotals = (
    memberId: string,
    memberName: string,
    data: any[]
  ): MemberBattingStats => {
    const totals = data.reduce(
      (acc, game) => ({
        games: acc.games + 1,
        at_bats: acc.at_bats + (game.at_bats || 0),
        hits: acc.hits + (game.hits || 0),
        doubles: acc.doubles + (game.doubles || 0),
        triples: acc.triples + (game.triples || 0),
        home_runs: acc.home_runs + (game.home_runs || 0),
        rbi: acc.rbi + (game.rbi || 0),
        runs: acc.runs + (game.runs || 0),
        walks: acc.walks + (game.walks || 0),
        stolen_bases: acc.stolen_bases + (game.stolen_bases || 0),
      }),
      {
        games: 0,
        at_bats: 0,
        hits: 0,
        doubles: 0,
        triples: 0,
        home_runs: 0,
        rbi: 0,
        runs: 0,
        walks: 0,
        stolen_bases: 0,
      }
    );

    // 打率計算
    const avg =
      totals.at_bats > 0 ? (totals.hits / totals.at_bats).toFixed(3) : ".000";

    // 出塁率計算
    const plateAppearances = totals.at_bats + totals.walks;
    const obp =
      plateAppearances > 0
        ? ((totals.hits + totals.walks) / plateAppearances).toFixed(3)
        : ".000";

    // 長打率計算
    const totalBases =
      totals.hits + totals.doubles + totals.triples * 2 + totals.home_runs * 3;
    const slg =
      totals.at_bats > 0 ? (totalBases / totals.at_bats).toFixed(3) : ".000";

    // OPS計算
    const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);

    return {
      member_id: memberId,
      member_name: memberName,
      ...totals,
      batting_average: avg,
      on_base_percentage: obp,
      slugging_percentage: slg,
      ops: ops,
    };
  };

  const calculateMemberPitchingTotals = (
    memberId: string,
    memberName: string,
    data: any[]
  ): MemberPitchingStats => {
    const totals = data.reduce(
      (acc, game) => ({
        games: acc.games + 1,
        innings_pitched: acc.innings_pitched + (game.innings_pitched || 0),
        hits_allowed: acc.hits_allowed + (game.hits_allowed || 0),
        runs_allowed: acc.runs_allowed + (game.runs_allowed || 0),
        earned_runs: acc.earned_runs + (game.earned_runs || 0),
        strikeouts: acc.strikeouts + (game.strikeouts || 0),
        walks: acc.walks + (game.walks || 0),
        home_runs_allowed:
          acc.home_runs_allowed + (game.home_runs_allowed || 0),
        wins: acc.wins + (game.win ? 1 : 0), // ← 実際の勝利数を集計
        losses: acc.losses + (game.loss ? 1 : 0), // ← 実際の敗戦数を集計
        saves: acc.saves + (game.save ? 1 : 0), // ← セーブ数を集計
      }),
      {
        games: 0,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        strikeouts: 0,
        walks: 0,
        home_runs_allowed: 0,
        wins: 0,
        losses: 0,
        saves: 0, // ← 追加
      }
    );

    // 勝率の計算を追加
    const decisions = totals.wins + totals.losses;
    const winPercentage =
      decisions > 0 ? ((totals.wins / decisions) * 100).toFixed(1) : "0.0";

    // 投球回を実際のイニング数に変換
    const actualInnings =
      Math.floor(totals.innings_pitched) +
      ((totals.innings_pitched % 1) * 10) / 3;

    // 投球回の表示形式
    const inningsDisplay = formatInnings(totals.innings_pitched);

    // 防御率計算（7回換算）
    const era =
      actualInnings > 0
        ? ((totals.earned_runs * 7) / actualInnings).toFixed(2)
        : "0.00";

    // WHIP計算
    const whip =
      actualInnings > 0
        ? ((totals.walks + totals.hits_allowed) / actualInnings).toFixed(2)
        : "0.00";

    // K/7計算
    const kPerNine =
      actualInnings > 0
        ? ((totals.strikeouts * 7) / actualInnings).toFixed(2)
        : "0.00";

    // BB/7計算
    const bbPerNine =
      actualInnings > 0
        ? ((totals.walks * 7) / actualInnings).toFixed(2)
        : "0.00";

    return {
      member_id: memberId,
      member_name: memberName,
      ...totals,
      innings_display: inningsDisplay,
      era: era,
      whip: whip,
      k_per_nine: kPerNine,
      bb_per_nine: bbPerNine,
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortStats = (stats: any[], field: string) => {
    return [...stats].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // 文字列の数値を数値に変換
      if (typeof aVal === "string" && aVal.startsWith(".")) {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
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

  if (battingStats.length === 0 && pitchingStats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">チーム成績</h3>
        <p className="text-gray-500 text-center py-8">
          まだ成績データがありません
        </p>
      </div>
    );
  }

  const sortedBattingStats = sortStats(battingStats, sortField);
  const sortedPitchingStats = sortStats(pitchingStats, sortField);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">チーム成績</h3>
      </div>

      {/* タブ */}
      <div className="border-b">
        <div className="flex">
          <button
            onClick={() => {
              setActiveTab("batting");
              setSortField("batting_average");
              setSortDirection("desc");
            }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "batting"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            打撃成績 ({battingStats.length}名)
          </button>
          <button
            onClick={() => {
              setActiveTab("pitching");
              setSortField("era");
              setSortDirection("asc");
            }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "pitching"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            投手成績 ({pitchingStats.length}名)
          </button>
        </div>
      </div>

      {/* 成績表 */}
      <div className="overflow-x-auto">
        {activeTab === "batting" && battingStats.length > 0 && (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  選手名
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("games")}
                >
                  試合
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("batting_average")}
                >
                  打率{" "}
                  {sortField === "batting_average" &&
                    (sortDirection === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("home_runs")}
                >
                  本塁打
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("rbi")}
                >
                  打点
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("ops")}
                >
                  OPS
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  打数
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  安打
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  二塁打
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  三塁打
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  得点
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  四球
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  盗塁
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  出塁率
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  長打率
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedBattingStats.map((stats, index) => (
                <tr
                  key={stats.member_id}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stats.member_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.games}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {stats.batting_average}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.home_runs}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.rbi}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {stats.ops}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.at_bats}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.hits}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.doubles}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.triples}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.runs}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.walks}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.stolen_bases}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.on_base_percentage}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.slugging_percentage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "pitching" && pitchingStats.length > 0 && (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  選手名
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("games")}
                >
                  登板
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("era")}
                >
                  防御率{" "}
                  {sortField === "era" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("innings_pitched")}
                >
                  投球回
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("strikeouts")}
                >
                  奪三振
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("whip")}
                >
                  WHIP
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  被安打
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  失点
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  自責点
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  与四球
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  被本塁打
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  K/7
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  BB/7
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  勝敗
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  セーブ
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  勝率
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPitchingStats.map((stats, index) => (
                <tr
                  key={stats.member_id}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stats.member_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.games}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {stats.era}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.innings_display}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.strikeouts}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {stats.whip}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.hits_allowed}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.runs_allowed}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.earned_runs}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.walks}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.home_runs_allowed}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.k_per_nine}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.bb_per_nine}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.wins}-{stats.losses}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {stats.saves}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {stats.win_percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
