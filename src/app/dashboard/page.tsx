"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PersonalStats from "@/components/stats/PersonalStats";

interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Game {
  id: string;
  name: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  opponent_name: string;
  status: string;
  home_score: number;
  opponent_score: number;
  home_team_id: string | null;
  created_at: string;
}

interface JoinRequest {
  id: string;
  team_id: string;
  user_id: string;
  status: string;
  requested_at: string;
  teams: {
    id: string;
    name: string;
  };
}

interface UserProfile {
  display_name: string | null;
}

interface Stats {
  totalTeams: number;
  totalGames: number;
  upcomingGames: number;
  completedGames: number;
  pendingRequests: number;
}

interface PendingAttendance {
  game_id: string;
  game_name: string;
  game_date: string;
  game_time: string | null;
  team_name: string;
}

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<JoinRequest[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalTeams: 0,
    totalGames: 0,
    upcomingGames: 0,
    completedGames: 0,
    pendingRequests: 0,
  });
  const [pendingAttendances, setPendingAttendances] = useState<
    PendingAttendance[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // 既にデータ取得中なら何もしない
    if (isDataLoading) return;

    const loadData = async () => {
      setIsDataLoading(true);
      await fetchUserProfile();
      await fetchDashboardData();
      setIsDataLoading(false);
    };

    loadData();
  }, [user?.id]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (data) {
        setUserProfile(data);
      } else if (!error) {
        // プロフィールが存在しない場合は作成
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            display_name: "ユーザー",
          })
          .select()
          .single();

        if (newProfile) {
          setUserProfile(newProfile);
        }
      }
    } catch (error) {
      console.error("プロフィール取得エラー:", error);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // チーム一覧を取得（自分が参加しているチーム）
      const { data: memberData } = await supabase
        .from("team_members")
        .select(
          `
          team_id,
          teams (
            id,
            name,
            description,
            created_at
          )
        `
        )
        .eq("user_id", user.id);

      if (memberData) {
        const userTeams = memberData
          .filter((item) => item.teams)
          .map((item) => item.teams as Team);
        setTeams(userTeams);
      }

      // 試合一覧を取得
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .or(
          `created_by.eq.${user.id},home_team_id.in.(${
            memberData?.map((m) => m.team_id).join(",") || ""
          })`
        )
        .order("game_date", { ascending: false })
        .limit(10);

      if (gamesData) {
        setGames(gamesData);
      }

      // 自分の参加申請を取得
      const { data: requestsData } = await supabase
        .from("team_join_requests")
        .select(
          `
          *,
          teams (
            id,
            name
          )
        `
        )
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (requestsData) {
        setMyRequests(requestsData);
      }

      // 自分がオーナーのチームへの申請を取得
      const { data: ownedTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", user.id);

      if (ownedTeams && ownedTeams.length > 0) {
        const teamIds = ownedTeams.map((t) => t.id);
        const { data: approvalsData } = await supabase
          .from("team_join_requests")
          .select(
            `
            *,
            teams (
              id,
              name
            )
          `
          )
          .in("team_id", teamIds)
          .eq("status", "pending");

        if (approvalsData) {
          setPendingApprovals(approvalsData);
        }
      }

      // 統計情報を計算
      const totalTeams = memberData?.length || 0;
      const totalGames = gamesData?.length || 0;
      const upcomingGames =
        gamesData?.filter((g) => g.status === "scheduled").length || 0;
      const completedGames =
        gamesData?.filter((g) => g.status === "completed").length || 0;
      const pendingRequests = requestsData?.length || 0;

      setStats({
        totalTeams,
        totalGames,
        upcomingGames,
        completedGames,
        pendingRequests,
      });

      // 未回答の出欠確認を取得
      if (user) {
        console.log("未回答出欠確認を取得開始");

        // 出欠確認の未回答を取得（修正版）
        // まず自分が所属するチームを取得
        const { data: myTeamMembers, error: tmError } = await supabase
          .from("team_members")
          .select("id, team_id")
          .eq("user_id", user.id);

        console.log("所属チーム:", myTeamMembers);
if (myTeamMembers && myTeamMembers.length > 0) {
  console.log("あなたのteam_member_id:", myTeamMembers[0].id);
  console.log("あなたのteam_id:", myTeamMembers[0].team_id);
}
        console.log("チーム取得エラー:", tmError);

        if (myTeamMembers && myTeamMembers.length > 0) {
          const teamIds = myTeamMembers.map((tm) => tm.team_id);
          const memberIds = myTeamMembers.map((tm) => tm.id);

          // まず出欠確認が有効な試合を取得
          const { data: activeGames, error: gamesError } = await supabase
            .from("games")
            .select(
              `
    id,
    name,
    game_date,
    game_time,
    status,
    home_team_id,
    attendance_check_enabled
  `
            )
            .in("home_team_id", teamIds)
            .eq("attendance_check_enabled", true)
            .in("status", ["scheduled", "in_progress"])
            .gte("game_date", new Date().toISOString().split("T")[0]);

          console.log("出欠確認が有効な試合:", activeGames);
          console.log("試合取得エラー:", gamesError);

          if (activeGames && activeGames.length > 0) {
            const gameIds = activeGames.map((g) => g.id);

            // 該当試合での自分の出欠状況を確認
            const { data: myAttendances, error: attendanceError } =
              await supabase
                .from("game_attendances")
                .select(
                  `
      id,
      game_id,
      status,
      team_member_id
    `
                )
                .in("game_id", gameIds)
                .in("team_member_id", memberIds);

            console.log("自分の出欠データ:", myAttendances);
            console.log("出欠取得エラー:", attendanceError);

            // 未回答の試合を特定
            const pendingGames = activeGames.filter((game) => {
              const myAttendance = myAttendances?.find(
                (a) => a.game_id === game.id
              );
              return !myAttendance || myAttendance.status === "pending";
            });

            console.log("未回答の試合:", pendingGames);

            if (pendingGames.length > 0) {
              // チーム名を取得
              const uniqueTeamIds = [
                ...new Set(
                  pendingGames.map((g) => g.home_team_id).filter((id) => id)
                ),
              ];

              const { data: teamsData } = await supabase
                .from("teams")
                .select("id, name")
                .in("id", uniqueTeamIds);

              console.log("チームデータ:", teamsData);

              // データを整形
              const formattedPending = pendingGames.map((game: any) => {
                const team = teamsData?.find((t) => t.id === game.home_team_id);
                return {
                  game_id: game.id,
                  game_name: game.name,
                  game_date: game.game_date,
                  game_time: game.game_time,
                  team_name: team?.name || "チーム",
                };
              });

              console.log("整形後の未回答データ:", formattedPending);
              setPendingAttendances(formattedPending);
            } else {
              console.log("未回答の出欠確認はありません");
            }
          }
        } else {
          console.log("所属チームがありません");
        }
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (
    requestId: string,
    action: "approved" | "rejected"
  ) => {
    try {
      const { error } = await supabase
        .from("team_join_requests")
        .update({
          status: action,
          responded_at: new Date().toISOString(),
          responded_by: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;

      // リストを更新
      setPendingApprovals((prev) => prev.filter((req) => req.id !== requestId));

      alert(
        action === "approved"
          ? "参加申請を承認しました"
          : "参加申請を却下しました"
      );

      // データを再取得
      fetchDashboardData();
    } catch (error) {
      console.error("申請処理エラー:", error);
      alert("処理に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            ようこそ、{userProfile?.display_name || "ユーザー"}さん
          </h1>
          <p className="mt-2 text-gray-600">
            草野球 is Goodへようこそ。今日も楽しく野球をしましょう！
          </p>
        </div>

        {/* 未回答の出欠確認アラート */}
        {pendingAttendances.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  出欠の回答をしてください🙇
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p className="mb-2">以下の試合の出欠確認が未回答です：</p>
                  <ul className="space-y-1">
                    {pendingAttendances.map((attendance) => (
                      <li key={attendance.game_id}>
                        <Link
                          href={`/games/${attendance.game_id}`}
                          className="underline hover:text-yellow-900"
                        >
                          {new Date(attendance.game_date).toLocaleDateString(
                            "ja-JP"
                          )}
                          {attendance.game_time && ` ${attendance.game_time}`}
                          {" - "}
                          {attendance.game_name}（{attendance.team_name}）
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 個人成績 */}
        {user && <PersonalStats userId={user.id} />}

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalTeams}
            </div>
            <div className="text-sm text-gray-600">所属チーム</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalGames}
            </div>
            <div className="text-sm text-gray-600">総試合数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {stats.upcomingGames}
            </div>
            <div className="text-sm text-gray-600">予定試合</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {stats.completedGames}
            </div>
            <div className="text-sm text-gray-600">完了試合</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {stats.pendingRequests}
            </div>
            <div className="text-sm text-gray-600">申請中</div>
          </div>
        </div>

        {/* 承認待ち申請 */}
        {pendingApprovals.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              承認待ちの参加申請
            </h3>
            <div className="space-y-2">
              {pendingApprovals.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between bg-white p-3 rounded"
                >
                  <div>
                    <span className="font-medium">{request.teams.name}</span>
                    への参加申請があります
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() =>
                        handleRequestAction(request.id, "approved")
                      }
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      承認
                    </button>
                    <button
                      onClick={() =>
                        handleRequestAction(request.id, "rejected")
                      }
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      却下
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 所属チーム */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  所属チーム
                </h2>
                <Link
                  href="/teams"
                  className="text-blue-600 hover:text-blue-700"
                >
                  すべて見る →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {teams.length > 0 ? (
                <div className="space-y-4">
                  {teams.slice(0, 3).map((team) => (
                    <div
                      key={team.id}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-lg font-medium text-blue-600 hover:text-blue-700"
                      >
                        {team.name}
                      </Link>
                      {team.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {team.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">まだチームに所属していません</p>
              )}
            </div>
          </div>

          {/* 最近の試合 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  最近の試合
                </h2>
                <Link
                  href="/games"
                  className="text-blue-600 hover:text-blue-700"
                >
                  すべて見る →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {games.length > 0 ? (
                <div className="space-y-4">
                  {games.slice(0, 3).map((game) => (
                    <div
                      key={game.id}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <Link
                        href={`/games/${game.id}`}
                        className="text-lg font-medium text-blue-600 hover:text-blue-700"
                      >
                        {game.name}
                      </Link>
                      <div className="mt-1 text-sm text-gray-600">
                        <p>
                          {new Date(game.game_date).toLocaleDateString("ja-JP")}
                          {game.game_time && ` ${game.game_time}`}
                        </p>
                        <p>vs {game.opponent_name}</p>
                        {game.status === "completed" && (
                          <p className="font-medium">
                            スコア: {game.home_score} - {game.opponent_score}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">試合の予定がありません</p>
              )}
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/teams/create"
            className="bg-green-600 text-white text-center py-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            新しいチームを作成
          </Link>
          <Link
            href="/games/create"
            className="bg-blue-600 text-white text-center py-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            試合を作成
          </Link>
          <Link
            href="/search/teams"
            className="bg-purple-600 text-white text-center py-4 rounded-lg hover:bg-purple-700 transition-colors"
          >
            チームを探す
          </Link>
        </div>
      </div>
    </div>
  );
}
