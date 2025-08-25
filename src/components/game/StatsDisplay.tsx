"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface GamePlayer {
  id: string;
  player_name: string;
  batting_order: number | null;
  position: string | null;
}

interface Game {
  id: string;
  status: string;
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
}

interface PlayerStats {
  player_id: string;
  player_name: string;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeruns: number;
  rbi: number;
  runs: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  batting_average: string;
  on_base_percentage: string;
  slugging_percentage: string;
}

interface PlayerBattingStatsView {
  player_id: string;
  player_name: string;
  game_id: string;
  hits: number;
  home_runs: number;
  doubles: number;
  triples: number;
  at_bats: number;
  walks: number;
  rbi: number;
  runs: number;
  stolen_bases: number;
  batting_average: number;
  on_base_percentage: number;
  slugging_percentage: number;
}

interface PlayerPitchingStatsView {
  player_id: string;
  player_name: string;
  game_id: string;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  strikeouts: number;
  walks: number;
  home_runs_allowed: number;
  era: number;
  whip: number;
  k_per_nine: number;
  bb_per_nine: number;
}

interface InningScore {
  inning: number;
  top_score: number;
  bottom_score: number;
}

interface Props {
  gameId: string;
  players: GamePlayer[];
}

// 打撃結果の分類
const HIT_RESULTS = ["安打", "二塁打", "三塁打", "本塁打"];
const OUT_RESULTS = [
  "三振",
  "ゴロ",
  "フライ",
  "ライナー",
  "犠打",
  "犠飛",
  "フィールダースチョイス",
];
const WALK_RESULTS = ["四球", "死球"];
const SACRIFICE_RESULTS = ["犠打", "犠飛"];

export default function StatsDisplay({ gameId, players }: Props) {
  const supabase = createClientComponentClient();

  const [gameStatus, setGameStatus] = useState<string>("in_progress");
  const [battingRecords, setBattingRecords] = useState<BattingRecord[]>([]);
  const [pitchingRecords, setPitchingRecords] = useState<PitchingRecord[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [inningScores, setInningScores] = useState<InningScore[]>([]);
  const [teamStats, setTeamStats] = useState({
    totalRuns: 0,
    totalHits: 0,
    totalErrors: 0,
    totalRBI: 0,
    teamBattingAverage: "0.000",
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"batting" | "pitching" | "score">(
    "batting"
  );

  useEffect(() => {
    fetchGameStatus();
  }, [gameId]);

  // 試合ステータスを取得
  const fetchGameStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("status")
        .eq("id", gameId)
        .single();

      if (data) {
        setGameStatus(data.status);
        // ステータスに応じて適切なデータ取得方法を選択
        if (data.status === "completed") {
          fetchStatsFromView();
        } else {
          fetchAllStatsForRealtime();
        }
      }
    } catch (error) {
      console.error("試合ステータス取得エラー:", error);
      // エラー時はリアルタイム計算にフォールバック
      fetchAllStatsForRealtime();
    }
  };

  // 試合終了後: ビューからデータ取得
  const fetchStatsFromView = async () => {
    setLoading(true);

    try {
      // 打撃成績をビューから取得
      const { data: battingData, error: battingError } = await supabase
        .from("player_batting_stats")
        .select("*")
        .eq("game_id", gameId);

      if (battingData) {
        // ビューのデータをStatsDisplay用の形式に変換
        const convertedStats = battingData.map(
          (stat: PlayerBattingStatsView) => ({
            player_id: stat.player_id,
            player_name: stat.player_name,
            at_bats: stat.at_bats,
            hits: stat.hits,
            doubles: stat.doubles,
            triples: stat.triples,
            homeruns: stat.home_runs,
            rbi: stat.rbi,
            runs: stat.runs,
            walks: stat.walks,
            strikeouts: 0, // ビューには三振数がないため、別途取得が必要
            stolen_bases: stat.stolen_bases,
            batting_average: stat.batting_average.toFixed(3),
            on_base_percentage: stat.on_base_percentage.toFixed(3),
            slugging_percentage: stat.slugging_percentage.toFixed(3),
          })
        );

        // 三振数を別途取得
        const { data: strikeoutData } = await supabase
          .from("game_batting_records")
          .select("player_id")
          .eq("game_id", gameId)
          .eq("result", "三振");

        if (strikeoutData) {
          convertedStats.forEach((stat) => {
            stat.strikeouts = strikeoutData.filter(
              (r) => r.player_id === stat.player_id
            ).length;
          });
        }

        // 打順順にソート
        convertedStats.sort((a, b) => {
          const orderA =
            players.find((p) => p.id === a.player_id)?.batting_order || 99;
          const orderB =
            players.find((p) => p.id === b.player_id)?.batting_order || 99;
          return orderA - orderB;
        });

        setPlayerStats(convertedStats);

        // チーム統計を計算
        const teamTotals = {
          totalHits: convertedStats.reduce((sum, s) => sum + s.hits, 0),
          totalRuns: convertedStats.reduce((sum, s) => sum + s.runs, 0),
          totalRBI: convertedStats.reduce((sum, s) => sum + s.rbi, 0),
          totalErrors: 0, // エラー数は別途取得が必要
          teamBattingAverage: (
            convertedStats.reduce((sum, s) => sum + s.hits, 0) /
            Math.max(
              1,
              convertedStats.reduce((sum, s) => sum + s.at_bats, 0)
            )
          ).toFixed(3),
        };
        setTeamStats(teamTotals);
      }

      // 投手成績をビューから取得
      const { data: pitchingData } = await supabase
        .from("player_pitching_stats")
        .select("*")
        .eq("game_id", gameId);

      if (pitchingData) {
        setPitchingRecords(
          pitchingData.map((p: PlayerPitchingStatsView) => ({
            id: p.player_id,
            game_id: p.game_id,
            player_id: p.player_id,
            innings_pitched: p.innings_pitched,
            hits_allowed: p.hits_allowed,
            runs_allowed: p.runs_allowed,
            earned_runs: p.earned_runs,
            strikeouts: p.strikeouts,
            walks: p.walks,
          }))
        );
      }

      // イニングスコアを取得
      await fetchInningScores();
    } catch (error) {
      console.error("ビューからのデータ取得エラー:", error);
      // エラー時はリアルタイム計算にフォールバック
      fetchAllStatsForRealtime();
    } finally {
      setLoading(false);
    }
  };

  // 試合進行中: リアルタイム計算（既存のロジック）
  const fetchAllStatsForRealtime = async () => {
    setLoading(true);
    await Promise.all([
      fetchBattingRecords(),
      fetchPitchingRecords(),
      fetchInningScores(),
    ]);
    setLoading(false);
  };

  const fetchBattingRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("game_batting_records")
        .select("*")
        .eq("game_id", gameId)
        .order("inning", { ascending: true });

      if (data) {
        setBattingRecords(data);
        calculatePlayerStats(data);
        calculateTeamStats(data);
      }
    } catch (error) {
      console.error("打撃記録取得エラー:", error);
    }
  };

  const fetchPitchingRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("game_pitching_records")
        .select("*")
        .eq("game_id", gameId);

      if (data) {
        setPitchingRecords(data);
      }
    } catch (error) {
      console.error("投手記録取得エラー:", error);
    }
  };

  const fetchInningScores = async () => {
    try {
      const { data, error } = await supabase
        .from("game_scores")
        .select("*")
        .eq("game_id", gameId)
        .order("inning", { ascending: true });

      if (data) {
        setInningScores(data);
      }
    } catch (error) {
      console.error("スコア取得エラー:", error);
    }
  };

  const calculatePlayerStats = (records: BattingRecord[]) => {
    const statsMap = new Map<string, PlayerStats>();

    // 各選手の記録を集計
    records.forEach((record) => {
      const player = players.find((p) => p.id === record.player_id);
      if (!player) return;

      if (!statsMap.has(record.player_id)) {
        statsMap.set(record.player_id, {
          player_id: record.player_id,
          player_name: player.player_name,
          at_bats: 0,
          hits: 0,
          doubles: 0,
          triples: 0,
          homeruns: 0,
          rbi: 0,
          runs: 0,
          walks: 0,
          strikeouts: 0,
          stolen_bases: 0,
          batting_average: "0.000",
          on_base_percentage: "0.000",
          slugging_percentage: "0.000",
        });
      }

      const stats = statsMap.get(record.player_id)!;

      // 打数計算（犠打・犠飛・四死球は打数に含まない）
      if (
        !WALK_RESULTS.includes(record.result) &&
        !SACRIFICE_RESULTS.includes(record.result)
      ) {
        stats.at_bats++;
      }

      // ヒット数計算
      if (HIT_RESULTS.includes(record.result)) {
        stats.hits++;

        if (record.result === "二塁打") stats.doubles++;
        if (record.result === "三塁打") stats.triples++;
        if (record.result === "本塁打") stats.homeruns++;
      }

      // その他の成績
      if (record.result === "三振") stats.strikeouts++;
      if (WALK_RESULTS.includes(record.result)) stats.walks++;
      if (record.run_scored) stats.runs++;
      if (record.stolen_base) stats.stolen_bases++;
      stats.rbi += record.rbi;
    });

    // 打率・出塁率・長打率を計算
    const statsArray = Array.from(statsMap.values()).map((stats) => {
      // 打率 = 安打数 / 打数
      const avg = stats.at_bats > 0 ? stats.hits / stats.at_bats : 0;
      stats.batting_average = avg.toFixed(3);

      // 出塁率 = (安打 + 四球) / (打数 + 四球 + 犠飛)
      const plateAppearances = stats.at_bats + stats.walks;
      const obp =
        plateAppearances > 0
          ? (stats.hits + stats.walks) / plateAppearances
          : 0;
      stats.on_base_percentage = obp.toFixed(3);

      // 長打率 = 塁打数 / 打数
      const totalBases =
        stats.hits + stats.doubles + stats.triples * 2 + stats.homeruns * 3;
      const slg = stats.at_bats > 0 ? totalBases / stats.at_bats : 0;
      stats.slugging_percentage = slg.toFixed(3);

      return stats;
    });

    // 打順順にソート
    statsArray.sort((a, b) => {
      const orderA =
        players.find((p) => p.id === a.player_id)?.batting_order || 99;
      const orderB =
        players.find((p) => p.id === b.player_id)?.batting_order || 99;
      return orderA - orderB;
    });

    setPlayerStats(statsArray);
  };

  const calculateTeamStats = (records: BattingRecord[]) => {
    let totalHits = 0;
    let totalAtBats = 0;
    let totalRuns = 0;
    let totalRBI = 0;

    records.forEach((record) => {
      if (HIT_RESULTS.includes(record.result)) totalHits++;
      if (
        !WALK_RESULTS.includes(record.result) &&
        !SACRIFICE_RESULTS.includes(record.result)
      ) {
        totalAtBats++;
      }
      if (record.run_scored) totalRuns++;
      totalRBI += record.rbi;
    });

    const teamAvg =
      totalAtBats > 0 ? (totalHits / totalAtBats).toFixed(3) : "0.000";

    setTeamStats({
      totalRuns,
      totalHits,
      totalErrors: 0,
      totalRBI,
      teamBattingAverage: teamAvg,
    });
  };

  // 投球回を表示形式に変換
  const formatInnings = (innings: number): string => {
    const wholeInnings = Math.floor(innings);
    const outs = Math.round((innings % 1) * 10);
    return `${wholeInnings}.${outs}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* データソース表示（開発時のみ表示） */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-500 text-right">
          データソース:{" "}
          {gameStatus === "completed"
            ? "データベースビュー"
            : "リアルタイム計算"}
        </div>
      )}

      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("batting")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "batting"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            打撃成績
          </button>
          <button
            onClick={() => setActiveTab("pitching")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "pitching"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            投手成績
          </button>
          <button
            onClick={() => setActiveTab("score")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "score"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            スコアボード
          </button>
        </nav>
      </div>

      {/* 打撃成績タブ */}
      {activeTab === "batting" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">打撃成績</h3>
            <div className="mt-2 text-sm text-gray-600">
              チーム打率: {teamStats.teamBattingAverage} | 総得点:{" "}
              {teamStats.totalRuns} | 総安打: {teamStats.totalHits} | 総打点:{" "}
              {teamStats.totalRBI}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    選手名
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    打数
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    安打
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    打率
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    本塁打
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    打点
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    得点
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    三振
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    四球
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    盗塁
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    出塁率
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    長打率
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {playerStats.map((stat) => (
                  <tr key={stat.player_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.player_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.at_bats}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.hits}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                      {stat.batting_average}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.homeruns}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.rbi}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.runs}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.strikeouts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.walks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.stolen_bases}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.on_base_percentage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {stat.slugging_percentage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 投手成績タブ */}
      {activeTab === "pitching" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">投手成績</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    投手名
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    投球回
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    被安打
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    失点
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    自責点
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    奪三振
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    与四球
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pitchingRecords.map((record) => {
                  const pitcher = players.find(
                    (p) => p.id === record.player_id
                  );
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {pitcher?.player_name || "不明"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {formatInnings(record.innings_pitched)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.hits_allowed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.runs_allowed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.earned_runs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.strikeouts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.walks}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* スコアボードタブ */}
      {activeTab === "score" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">スコアボード</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    イニング
                  </th>
                  {Array.from({ length: 7 }, (_, i) => (
                    <th
                      key={i + 1}
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {i + 1}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    計
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    先攻
                  </td>
                  {Array.from({ length: 7 }, (_, i) => {
                    const score = inningScores.find((s) => s.inning === i + 1);
                    return (
                      <td
                        key={i}
                        className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900"
                      >
                        {score?.top_score ?? "-"}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {inningScores.reduce(
                      (sum, s) => sum + (s.top_score || 0),
                      0
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    後攻
                  </td>
                  {Array.from({ length: 7 }, (_, i) => {
                    const score = inningScores.find((s) => s.inning === i + 1);
                    return (
                      <td
                        key={i}
                        className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900"
                      >
                        {score?.bottom_score ?? "-"}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                    {inningScores.reduce(
                      (sum, s) => sum + (s.bottom_score || 0),
                      0
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
