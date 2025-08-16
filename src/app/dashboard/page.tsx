"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    fetchUserProfile();
    fetchDashboardData();
  }, [user]);

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
      } else if (!error || error.code === 'PGRST116') {
        // プロフィールが存在しない場合は設定ページへ
        router.push("/auth/setup");
      }
    } catch (error) {
      console.error("プロフィール取得エラー:", error);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // 所属チーム情報を取得（オーナーとメンバー両方）
      // 1. オーナーとして所有するチーム
      const { data: ownedTeams, error: ownedError } = await supabase
        .from("teams")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      // 2. メンバーとして所属するチーム
      const { data: memberTeams, error: memberError } = await supabase
        .from("team_members")
        .select(`
          team_id,
          teams:team_id (
            id,
            name,
            description,
            created_at
          )
        `)
        .eq("user_id", user.id);

      // チームを統合（重複を除く）
      const allTeams: Team[] = [];
      const teamIds = new Set<string>();

      if (ownedTeams) {
        ownedTeams.forEach(team => {
          if (!teamIds.has(team.id)) {
            allTeams.push(team);
            teamIds.add(team.id);
          }
        });
      }

      if (memberTeams) {
        memberTeams.forEach(member => {
          const team = member.teams as unknown as Team;
          if (team && !teamIds.has(team.id)) {
            allTeams.push(team);
            teamIds.add(team.id);
          }
        });
      }

      // 作成日でソート
      allTeams.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTeams(allTeams.slice(0, 5)); // 最新5件のみ表示

      // 試合情報を取得（所属チームの試合も含む）
      const teamIdArray = Array.from(teamIds);
      
      // 自分が作成した試合 OR 所属チームの試合
      let allGames: Game[] = [];
      
      // 自分が作成した試合
      const { data: createdGames } = await supabase
        .from("games")
        .select("*")
        .eq("created_by", user.id);

      if (createdGames) {
        allGames = [...createdGames];
      }

      // 所属チームの試合
      if (teamIdArray.length > 0) {
        const { data: teamGames } = await supabase
          .from("games")
          .select("*")
          .in("home_team_id", teamIdArray);

        if (teamGames) {
          // 重複を除く
          const existingGameIds = new Set(allGames.map(g => g.id));
          teamGames.forEach(game => {
            if (!existingGameIds.has(game.id)) {
              allGames.push(game);
            }
          });
        }
      }

      // 日付でソート
      allGames.sort((a, b) => 
        new Date(a.game_date).getTime() - new Date(b.game_date).getTime()
      );

      setGames(allGames);

      // 統計情報を計算
      const upcoming = allGames.filter(g => g.status === "scheduled").length;
      const completed = allGames.filter(g => g.status === "completed").length;

      setStats({
        totalTeams: allTeams.length,
        totalGames: allGames.length,
        upcomingGames: upcoming,
        completedGames: completed,
        pendingRequests: 0,
      });

      // 自分の参加申請を取得
      const { data: myRequestsData } = await supabase
        .from("team_join_requests")
        .select(`
          *,
          teams:team_id (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });

      if (myRequestsData) {
        setMyRequests(myRequestsData);
      }

      // 自分がオーナーのチームへの参加申請を取得
      if (ownedTeams && ownedTeams.length > 0) {
        const ownedTeamIds = ownedTeams.map((t) => t.id);
        const { data: pendingData } = await supabase
          .from("team_join_requests")
          .select(`
            *,
            teams:team_id (
              id,
              name
            )
          `)
          .in("team_id", ownedTeamIds)
          .eq("status", "pending");

        if (pendingData) {
          setPendingApprovals(pendingData);
          setStats(prev => ({
            ...prev,
            pendingRequests: pendingData.length
          }));
        }
      }
    } catch (error) {
      console.error("ダッシュボードデータ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUpcomingGames = () => {
    return games.filter((game) => game.status === "scheduled").slice(0, 5);
  };

  const getRecentGames = () => {
    return games.filter((game) => game.status === "completed").slice(0, 5);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { color: "bg-blue-100 text-blue-800", text: "予定" },
      in_progress: { color: "bg-yellow-100 text-yellow-800", text: "進行中" },
      completed: { color: "bg-green-100 text-green-800", text: "終了" },
      cancelled: { color: "bg-red-100 text-red-800", text: "中止" },
      pending: { color: "bg-yellow-100 text-yellow-800", text: "申請中" },
      approved: { color: "bg-green-100 text-green-800", text: "承認済" },
      rejected: { color: "bg-red-100 text-red-800", text: "却下" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-100 text-gray-800",
      text: status,
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ダッシュボード
              </h1>
              <p className="mt-1 text-gray-600">
                ようこそ、{userProfile?.display_name || "ゲスト"}さん
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/settings"
                className="text-gray-600 hover:text-gray-900"
                title="アカウント設定"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>
              <Link
                href="/teams/create"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                チーム作成
              </Link>
              <Link
                href="/games/create"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                試合作成
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 通知エリア */}
        {pendingApprovals.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-yellow-800">
                {pendingApprovals.length}件の参加申請が承認待ちです
              </span>
              <Link
                href="/teams"
                className="ml-auto text-yellow-600 hover:text-yellow-700 font-medium"
              >
                確認する →
              </Link>
            </div>
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">所属チーム</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalTeams}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">全試合数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalGames}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">予定試合</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.upcomingGames}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">完了試合</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completedGames}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">承認待ち</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.pendingRequests}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 参加申請状況 */}
        {myRequests.length > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                参加申請状況
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {myRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Link
                        href={`/teams/${request.team_id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {request.teams?.name}
                      </Link>
                      <p className="text-sm text-gray-500">
                        申請日: {new Date(request.requested_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 所属チーム */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  所属チーム
                </h2>
                <Link
                  href="/teams"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  すべて見る
                </Link>
              </div>
            </div>
            <div className="p-6">
              {teams.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">所属チームがありません</p>
                  <div className="space-y-2">
                    <Link
                      href="/teams/create"
                      className="block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      チームを作成
                    </Link>
                    <Link
                      href="/search/teams"
                      className="block px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                    >
                      チームを探す
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {teams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {team.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {team.description || "説明なし"}
                          </p>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 今後の試合 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  今後の試合
                </h2>
                <Link
                  href="/games"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  すべて見る
                </Link>
              </div>
            </div>
            <div className="p-6">
              {getUpcomingGames().length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    予定された試合がありません
                  </p>
                  <Link
                    href="/games/create"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    試合を作成
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {getUpcomingGames().map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.id}`}
                      className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {game.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span>
                              {new Date(game.game_date).toLocaleDateString(
                                "ja-JP"
                              )}
                            </span>
                            {game.game_time && <span>{game.game_time}</span>}
                            <span>vs {game.opponent_name}</span>
                          </div>
                        </div>
                        {getStatusBadge(game.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 最近の試合結果 */}
        {getRecentGames().length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                最近の試合結果
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {getRecentGames().map((game) => (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {game.name}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>
                            {new Date(game.game_date).toLocaleDateString(
                              "ja-JP"
                            )}
                          </span>
                          <span className="font-semibold">
                            {game.home_score} - {game.opponent_score}
                          </span>
                          <span>vs {game.opponent_name}</span>
                        </div>
                      </div>
                      {getStatusBadge(game.status)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}