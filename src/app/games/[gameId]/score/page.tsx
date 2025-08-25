"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Game {
  id: string;
  name: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  home_team_id: string | null;
  opponent_name: string;
  status: string;
  home_score: number;
  opponent_score: number;
  created_by: string;
}

interface Team {
  id: string;
  name: string;
}

interface InningScore {
  inning: number;
  top: number | null; // 先攻
  bottom: number | null; // 後攻
}

interface PageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function ScoreInputPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [innings, setInnings] = useState<InningScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isMyTeamBatFirst, setIsMyTeamBatFirst] = useState(true); // マイチームが先攻かどうか

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // 認証状態の読み込み中は何もしない
    if (authLoading) return;

    // 未認証の場合はログインページへ
    if (!user) {
      router.push("/login");
      return;
    }

    // 認証済みの場合のみデータ取得
    if (gameId) {
      fetchGameData();
    }
  }, [gameId, user, authLoading]);

  const fetchGameData = async () => {
    try {
      // 試合情報を取得
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error("試合取得エラー:", gameError);
        router.push("/games");
        return;
      }

      setGame(gameData);

      // チーム情報を取得
      if (gameData.home_team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("id", gameData.home_team_id)
          .single();

        if (teamData) {
          setTeam(teamData);
        }
      }

      // 編集権限の確認
      const isOwner = gameData.created_by === user?.id;
      const { data: teamOwner } = await supabase
        .from("teams")
        .select("owner_id")
        .eq("id", gameData.home_team_id)
        .single();

      setCanEdit(isOwner || teamOwner?.owner_id === user?.id);

      // 既存のイニングスコアを取得
      const { data: existingScores, error: scoresError } = await supabase
        .from("game_scores")
        .select("*")
        .eq("game_id", gameId)
        .order("inning", { ascending: true });

      if (existingScores && existingScores.length > 0) {
        // 既存のスコアがある場合
        const maxInning = Math.max(...existingScores.map((s) => s.inning), 7);
        const loadedInnings: InningScore[] = [];

        // 先攻/後攻の設定を取得
        if (existingScores[0].is_my_team_bat_first !== undefined) {
          setIsMyTeamBatFirst(existingScores[0].is_my_team_bat_first);
        }

        for (let i = 1; i <= maxInning; i++) {
          const existingScore = existingScores.find((s) => s.inning === i);
          loadedInnings.push({
            inning: i,
            top: existingScore?.top_score ?? null,
            bottom: existingScore?.bottom_score ?? null,
          });
        }
        setInnings(loadedInnings);
      } else {
        // 新規の場合は7回まで初期化
        const initialInnings: InningScore[] = [];
        for (let i = 1; i <= 7; i++) {
          initialInnings.push({
            inning: i,
            top: null,
            bottom: null,
          });
        }
        setInnings(initialInnings);
      }

      // 試合が開始されていない場合は開始状態に更新
      if (gameData.status === "scheduled") {
        await updateGameStatus("in_progress");
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateGameStatus = async (status: string) => {
    try {
      const { error } = await supabase
        .from("games")
        .update({
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (!error && game) {
        setGame({ ...game, status });
      }
    } catch (error) {
      console.error("ステータス更新エラー:", error);
    }
  };

  const handleInningScoreChange = (
    inningIndex: number,
    side: "top" | "bottom",
    value: string
  ) => {
    const newInnings = [...innings];
    const score = value === "" ? null : parseInt(value);

    if (side === "top") {
      newInnings[inningIndex].top = score;
    } else {
      newInnings[inningIndex].bottom = score;
    }

    setInnings(newInnings);
  };

  const calculateTotalScore = (side: "top" | "bottom") => {
    return innings.reduce((total, inning) => {
      const score = side === "top" ? inning.top : inning.bottom;
      return total + (score || 0);
    }, 0);
  };

  const handleSave = async () => {
    if (!canEdit || !game) return;

    setSaving(true);
    try {
      const topTotal = calculateTotalScore("top");
      const bottomTotal = calculateTotalScore("bottom");

      // マイチームが先攻か後攻かで保存するスコアを決定
      const myTeamScore = isMyTeamBatFirst ? topTotal : bottomTotal;
      const opponentScore = isMyTeamBatFirst ? bottomTotal : topTotal;

      // 試合のスコアを更新
      const { error: gameError } = await supabase
        .from("games")
        .update({
          home_score: myTeamScore,
          opponent_score: opponentScore,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (gameError) {
        throw gameError;
      }

      // イニングごとのスコアを保存
      for (const inning of innings) {
        if (inning.top !== null || inning.bottom !== null) {
          // 既存のスコアを更新または新規作成
          const { error: scoreError } = await supabase
            .from("game_scores")
            .upsert(
              {
                game_id: gameId,
                inning: inning.inning,
                top_score: inning.top || 0,
                bottom_score: inning.bottom || 0,
                is_my_team_bat_first: isMyTeamBatFirst,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "game_id,inning",
              }
            );

          if (scoreError) {
            console.error("イニングスコア保存エラー:", scoreError);
          }
        }
      }

      alert("スコアを保存しました");

      // 試合詳細ページに戻る
      router.push(`/games/${gameId}`);
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteGame = async () => {
    if (!confirm("試合を終了しますか？")) return;

    setSaving(true);
    try {
      const topTotal = calculateTotalScore("top");
      const bottomTotal = calculateTotalScore("bottom");

      // マイチームが先攻か後攻かで保存するスコアを決定
      const myTeamScore = isMyTeamBatFirst ? topTotal : bottomTotal;
      const opponentScore = isMyTeamBatFirst ? bottomTotal : topTotal;

      const { error: gameError } = await supabase
        .from("games")
        .update({
          home_score: myTeamScore,
          opponent_score: opponentScore,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (gameError) throw gameError;

      // イニングごとのスコアを保存
      for (const inning of innings) {
        if (inning.top !== null || inning.bottom !== null) {
          const { error: scoreError } = await supabase
            .from("game_scores")
            .upsert(
              {
                game_id: gameId,
                inning: inning.inning,
                top_score: inning.top || 0,
                bottom_score: inning.bottom || 0,
                is_my_team_bat_first: isMyTeamBatFirst,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "game_id,inning",
              }
            );

          if (scoreError) {
            console.error("イニングスコア保存エラー:", scoreError);
          }
        }
      }

      alert("試合を終了しました");
      router.push(`/games/${gameId}`);
    } catch (error) {
      console.error("終了処理エラー:", error);
      alert("終了処理に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const addExtraInning = () => {
    setInnings([
      ...innings,
      {
        inning: innings.length + 1,
        top: null,
        bottom: null,
      },
    ]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!game || !canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {!game ? "試合が見つかりません" : "スコア入力の権限がありません"}
          </p>
          <Link href="/games" className="text-blue-600 hover:text-blue-700">
            試合一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  const topTotal = calculateTotalScore("top");
  const bottomTotal = calculateTotalScore("bottom");
  const myTeamName = team?.name || "マイチーム";
  const topTeamName = isMyTeamBatFirst ? myTeamName : game.opponent_name;
  const bottomTeamName = isMyTeamBatFirst ? game.opponent_name : myTeamName;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/games/${gameId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            試合詳細に戻る
          </Link>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{game.name}</h1>
              <p className="text-gray-600 mt-1">
                {new Date(game.game_date).toLocaleDateString("ja-JP")}
                {game.location && ` @ ${game.location}`}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "途中保存"}
              </button>
              <button
                onClick={handleCompleteGame}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                試合終了
              </button>
            </div>
          </div>
        </div>

        {/* 先攻/後攻の選択 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              マイチーム（{myTeamName}）は：
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsMyTeamBatFirst(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isMyTeamBatFirst
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                先攻
              </button>
              <button
                onClick={() => setIsMyTeamBatFirst(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !isMyTeamBatFirst
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                後攻
              </button>
            </div>
          </div>
        </div>

        {/* スコアボード */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          {/* チーム名とトータルスコア */}
          <div className="bg-gray-900 text-white p-4">
            <div className="grid grid-cols-3 gap-4 items-center text-center">
              <div>
                <div className="text-sm text-gray-400 mb-1">先攻</div>
                <div className="text-xl font-bold">{topTeamName}</div>
              </div>
              <div className="text-4xl font-bold">
                <span
                  className={topTotal > bottomTotal ? "text-yellow-400" : ""}
                >
                  {topTotal}
                </span>
                <span className="mx-4 text-gray-500">-</span>
                <span
                  className={bottomTotal > topTotal ? "text-yellow-400" : ""}
                >
                  {bottomTotal}
                </span>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">後攻</div>
                <div className="text-xl font-bold">{bottomTeamName}</div>
              </div>
            </div>
          </div>

          {/* イニングスコア表 */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                    Team
                  </th>
                  {innings.map((inning) => (
                    <th
                      key={inning.inning}
                      className="px-3 py-2 text-center text-xs font-medium text-gray-600"
                    >
                      {inning.inning}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 uppercase bg-gray-200">
                    計
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* 先攻 */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50">
                    <span className="flex items-center">
                      <span className="text-xs text-gray-500 mr-2">先攻</span>
                      {topTeamName}
                      {isMyTeamBatFirst && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          自チーム
                        </span>
                      )}
                    </span>
                  </td>
                  {innings.map((inning, index) => (
                    <td key={`top-${inning.inning}`} className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={inning.top ?? ""}
                        onChange={(e) =>
                          handleInningScoreChange(index, "top", e.target.value)
                        }
                        className="w-12 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!canEdit}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center text-lg font-bold bg-gray-100">
                    {topTotal}
                  </td>
                </tr>

                {/* 後攻 */}
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50">
                    <span className="flex items-center">
                      <span className="text-xs text-gray-500 mr-2">後攻</span>
                      {bottomTeamName}
                      {!isMyTeamBatFirst && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          自チーム
                        </span>
                      )}
                    </span>
                  </td>
                  {innings.map((inning, index) => (
                    <td key={`bottom-${inning.inning}`} className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={inning.bottom ?? ""}
                        onChange={(e) =>
                          handleInningScoreChange(
                            index,
                            "bottom",
                            e.target.value
                          )
                        }
                        className="w-12 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!canEdit}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center text-lg font-bold bg-gray-100">
                    {bottomTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 延長回追加ボタン */}
          {innings.length < 10 && (
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={addExtraInning}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                延長回を追加
              </button>
            </div>
          )}
        </div>

        {/* 操作ヒント */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">スコア入力のヒント</p>
              <ul className="list-disc list-inside space-y-1">
                <li>まず、マイチームが先攻か後攻かを選択してください</li>
                <li>各イニングの得点を入力してください（基本7回制）</li>
                <li>途中保存で進行状況を保存できます</li>
                <li>
                  延長戦の場合は「延長回を追加」ボタンで回を追加できます（最大10回まで）
                </li>
                <li>試合終了ボタンで試合を完了状態にできます</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
