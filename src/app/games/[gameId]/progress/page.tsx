"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BattingRecordInput from "@/components/game/BattingRecordInput";
import PlayerSubstitution from "@/components/game/PlayerSubstitution";
import StatsDisplay from "@/components/game/StatsDisplay";
import PitchingRecordInput from "@/components/game/PitchingRecordInput";
import PitchingStatsDisplay from "@/components/game/PitchingStatsDisplay";
import RunnerDisplay from "@/components/game/RunnerDisplay";

// 型定義
interface Game {
  id: string;
  name: string;
  game_date: string;
  status: string;
  home_team_id: string;
  home_score: number;
  opponent_score: number;
  opponent_name: string;
  created_by: string;
}

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

interface InningData {
  inning: number;
  topBottom: "top" | "bottom";
  currentBatter: GamePlayer | null;
  runs: number;
  hits: number;
  errors: number;
  outs: number;
  isCompleted: boolean;
  isLocked: boolean;
}

interface BattingRecord {
  id: string;
  game_id: string;
  player_id: string;
  inning: number;
  result: string;
  rbi: number;
  run_scored: boolean;
}

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

// 草野球の最大イニング数
const MAX_INNINGS = 7;

export default function GameProgressPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClientComponentClient();

  // 状態管理
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [activeTab, setActiveTab] = useState<
    "batting" | "substitution" | "pitching" | "stats"
  >("batting");
  const [canEdit, setCanEdit] = useState(false);
  const [selectedInning, setSelectedInning] = useState(1);
  const [selectedTopBottom, setSelectedTopBottom] = useState<"top" | "bottom">(
    "top"
  );
  const [currentInning, setCurrentInning] = useState<InningData | null>(null);
  const [allInningsData, setAllInningsData] = useState<Map<string, InningData>>(
    new Map()
  );
  const [battingRecords, setBattingRecords] = useState<BattingRecord[]>([]);
  const [isMyTeamBatFirst, setIsMyTeamBatFirst] = useState<boolean | null>(
    null
  );
  const [runnerRefreshTrigger, setRunnerRefreshTrigger] = useState(0);

  useEffect(() => {
    // 認証状態の読み込み中は何もしない
    if (authLoading) return;

    // 未認証の場合はログインページへ
    if (!user) {
      router.push("/login");
      return;
    }

    // 認証済みの場合のみデータ取得
    fetchGameData();
  }, [user, authLoading, gameId]);

  useEffect(() => {
    if (selectedInning && selectedTopBottom) {
      loadInningData(selectedInning, selectedTopBottom);
    }
  }, [selectedInning, selectedTopBottom]);

  const fetchGameData = async () => {
    try {
      setLoading(true);

      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error("試合情報取得エラー:", gameError);
        // 404エラーの場合のみダッシュボードへ
        if (gameError?.code === "PGRST116") {
          router.push("/dashboard");
        }
        // それ以外のエラーは再試行を促す
        return;
      }

      setGame(gameData);

      // 編集権限の確認
      const isOwner = gameData.created_by === user?.id;
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", gameData.home_team_id)
        .eq("user_id", user?.id)
        .single();

      setCanEdit(
        isOwner || teamMember?.role === "admin" || teamMember?.role === "member"
      );

      // 先攻/後攻の設定を取得
      const { data: scoreData } = await supabase
        .from("game_scores")
        .select("is_my_team_bat_first")
        .eq("game_id", gameId)
        .limit(1)
        .single();

      if (scoreData) {
        setIsMyTeamBatFirst(scoreData.is_my_team_bat_first);
      }

      await fetchPlayers();
      await loadAllInningsData();
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .order("batting_order", { ascending: true });

      if (error) throw error;
      if (data) {
        setPlayers(data);
      }
    } catch (error) {
      console.error("選手データ取得エラー:", error);
    }
  };

  const loadAllInningsData = async () => {
    try {
      // 打撃記録を取得
      const { data: records } = await supabase
        .from("game_batting_records")
        .select("*")
        .eq("game_id", gameId)
        .order("inning", { ascending: true });

      if (records) {
        setBattingRecords(records);
      }

      // イニングごとのデータを構築
      const inningsMap = new Map<string, InningData>();

      // 先攻/後攻に基づいて自チームの攻撃回を決定
      const myTeamTopBottom = isMyTeamBatFirst ? "top" : "bottom";

      // 自チームの攻撃回のみデータを作成
      for (let inning = 1; inning <= MAX_INNINGS; inning++) {
        const key = `${inning}-${myTeamTopBottom}`;
        const inningRecords = records?.filter((r) => r.inning === inning) || [];
        // アウト数を計算（併殺・三重殺を考慮）
        let outCount = 0;
        inningRecords.forEach((r) => {
          if (OUT_RESULTS.includes(r.result)) {
            if (r.notes?.includes("併殺（ダブルプレー）")) {
              outCount += 2;
            } else if (r.notes?.includes("三重殺（トリプルプレー）")) {
              outCount += 3;
            } else {
              outCount += 1;
            }
          }
        });
        const hitCount = inningRecords.filter((r) =>
          ["安打", "二塁打", "三塁打", "本塁打"].includes(r.result)
        ).length;
        const runCount = inningRecords
          .filter((r) => r.run_scored)
          .reduce((sum) => sum + 1, 0);

        inningsMap.set(key, {
          inning,
          topBottom: myTeamTopBottom,
          currentBatter: null,
          runs: runCount,
          hits: hitCount,
          errors: 0,
          outs: outCount,
          isCompleted: outCount >= 3,
          isLocked: outCount >= 3,
        });
      }

      setAllInningsData(inningsMap);

      // 現在進行中のイニングを計算
      // 現在進行中のイニングを計算
      if (records && records.length > 0) {
        const maxRecordedInning = Math.max(...records.map((r) => r.inning));
        const currentInningRecords = records.filter(
          (r) => r.inning === maxRecordedInning
        );

        // アウト数を計算（併殺・三重殺を考慮）
        let currentOuts = 0;
        currentInningRecords.forEach((r) => {
          if (OUT_RESULTS.includes(r.result)) {
            if (r.notes?.includes("併殺（ダブルプレー）")) {
              currentOuts += 2;
            } else if (r.notes?.includes("三重殺（トリプルプレー）")) {
              currentOuts += 3;
            } else {
              currentOuts += 1;
            }
          }
        });

        if (currentOuts >= 3) {
          const nextInning = maxRecordedInning + 1;
          if (nextInning <= MAX_INNINGS) {
            setSelectedInning(nextInning);
            setSelectedTopBottom(myTeamTopBottom);
          } else {
            // 7回を超えたら最終イニングを表示
            setSelectedInning(MAX_INNINGS);
            setSelectedTopBottom(myTeamTopBottom);
          }
        } else {
          setSelectedInning(maxRecordedInning);
          setSelectedTopBottom(myTeamTopBottom);
        }
      } else {
        setSelectedInning(1);
        setSelectedTopBottom(myTeamTopBottom);
      }
    } catch (error) {
      console.error("イニングデータ読み込みエラー:", error);
    }
  };

  const loadInningData = async (
    inning: number,
    topBottom: "top" | "bottom"
  ) => {
    const key = `${inning}-${topBottom}`;
    const data = allInningsData.get(key);

    if (data) {
      setCurrentInning(data);
    } else {
      setCurrentInning({
        inning,
        topBottom,
        currentBatter: null,
        runs: 0,
        hits: 0,
        errors: 0,
        outs: 0,
        isCompleted: false,
        isLocked: false,
      });
    }

    // 相手チームの得点を取得
    if (isMyTeamBatFirst !== null) {
      const opponentTopBottom = isMyTeamBatFirst ? "bottom" : "top";
      const { data: scoreData } = await supabase
        .from("game_scores")
        .select("*")
        .eq("game_id", gameId)
        .eq("inning", inning)
        .single();

      if (scoreData) {
        const score =
          opponentTopBottom === "top"
            ? scoreData.top_score
            : scoreData.bottom_score;
        // 必要に応じて相手チームのスコアを表示
      }
    }
  };

  const handleInningChange = (
    newInning: number,
    newTopBottom: "top" | "bottom"
  ) => {
    setSelectedInning(newInning);
    setSelectedTopBottom(newTopBottom);
    // loadAllInningsDataは呼ばない（ユーザーが手動でタブを選択した場合は自動遷移しない）
  };

  const checkGameEnd = () => {
    const completedCount = Array.from(allInningsData.values()).filter(
      (data) => data.isCompleted
    ).length;

    if (completedCount >= MAX_INNINGS) {
      // 7回完了時の処理
      alert("試合が終了しました！");
      // 必要に応じて試合終了処理を実装
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">試合情報が見つかりません</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/games/${gameId}`}
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← 試合詳細に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{game.name}</h1>
          <div className="mt-2 text-gray-600">
            <span>{new Date(game.game_date).toLocaleDateString("ja-JP")}</span>
            <span className="mx-2">vs</span>
            <span>{game.opponent_name}</span>
          </div>
        </div>

        {/* イニング選択タブ */}
        {isMyTeamBatFirst !== null && (
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <div className="flex space-x-2 overflow-x-auto">
              {Array.from({ length: MAX_INNINGS }, (_, i) => i + 1).map(
                (inning) => {
                  const key = `${inning}-${
                    isMyTeamBatFirst ? "top" : "bottom"
                  }`;
                  const data = allInningsData.get(key);
                  const isActive = selectedInning === inning;

                  return (
                    <button
                      key={inning}
                      onClick={() =>
                        handleInningChange(
                          inning,
                          isMyTeamBatFirst ? "top" : "bottom"
                        )
                      }
                      className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : data?.isCompleted
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {inning}回{isMyTeamBatFirst ? "表" : "裏"}
                      {data?.isCompleted && " ✓"}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <div className="flex space-x-1 p-4">
              <button
                onClick={() => setActiveTab("batting")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "batting"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                打撃記録
              </button>
              <button
                onClick={() => setActiveTab("substitution")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "substitution"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                選手交代
              </button>
              <button
                onClick={() => setActiveTab("pitching")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "pitching"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                投手記録
              </button>
              <button
                onClick={() => setActiveTab("stats")}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === "stats"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                成績表示
              </button>
            </div>
          </div>

          {/* タブコンテンツ */}
          <div className="p-6">
            {activeTab === "batting" && (
              <div className="space-y-6">
                {/* ランナー表示 */}
                <RunnerDisplay
                  gameId={gameId}
                  currentInning={selectedInning}
                  refreshTrigger={runnerRefreshTrigger}
                  onRunnerUpdate={async () => {
                    await loadAllInningsData();
                  }}
                />

                <BattingRecordInput
                  gameId={gameId}
                  players={players}
                  currentInning={selectedInning}
                  isTopBottom={selectedTopBottom}
                  canEdit={canEdit}
                  onRecordSaved={async () => {
                    await loadAllInningsData();
                    setRunnerRefreshTrigger((prev) => prev + 1);
                  }}
                  onInningChange={async (newInning, newTopBottom) => {
                    handleInningChange(newInning, newTopBottom);
                    // 3アウトによる自動イニング交代の場合のみデータを再読み込み
                    await loadAllInningsData();
                  }}
                  onGameEnd={checkGameEnd}
                />
              </div>
            )}

            {activeTab === "substitution" && (
              <PlayerSubstitution
                gameId={gameId}
                players={players}
                onSubstitution={() => fetchPlayers()}
                canEdit={canEdit}
              />
            )}

            {activeTab === "pitching" && (
              <div className="space-y-4">
                <PitchingRecordInput
                  gameId={gameId}
                  players={players}
                  canEdit={canEdit}
                  onRecordSaved={fetchPlayers}
                />
                <PitchingStatsDisplay gameId={gameId} />
              </div>
            )}

            {activeTab === "stats" && (
              <StatsDisplay gameId={gameId} players={players} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
