// components/dashboard/Dashboard.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "../auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DashboardData {
  teams: Team[];
  recentGames: Game[];
  upcomingGames: Game[];
  stats: UserStats;
}

interface Team {
  id: string;
  name: string;
  member_count: number;
  user_role: string;
}

interface Game {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  venue: string;
  status: string;
  participants: {
    id: string;
    participant_name: string;
    is_home: boolean;
    total_score: number;
  }[];
}

interface UserStats {
  totalGames: number;
  wins: number;
  totalTeams: number;
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    teams: [],
    recentGames: [],
    upcomingGames: [],
    stats: { totalGames: 0, wins: 0, totalTeams: 0 },
  });
  const [loading, setLoading] = useState(true);

  const { user, profile } = useAuth();
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // 所属チームの取得
      const { data: teamsData } = await supabase
        .from("team_members")
        .select(
          `
          role,
          teams (
            id,
            name,
            team_members (count)
          )
        `
        )
        .eq("user_id", user.id);

      // 最近の試合の取得（完了した試合）
      const { data: recentGamesData } = await supabase
        .from("games")
        .select(
          `
          id,
          title,
          date,
          start_time,
          venue,
          status,
          game_participants(
            id,
            participant_name,
            is_home,
            total_score
          )
        `
        )
        .eq("status", "completed")
        .or(`created_by.eq.${user.id},game_participants.user_id.eq.${user.id}`)
        .order("date", { ascending: false })
        .limit(5);

      // 今後の試合の取得
      const { data: upcomingGamesData } = await supabase
        .from("games")
        .select(
          `
          id,
          title,
          date,
          start_time,
          venue,
          status,
          game_participants(
            id,
            participant_name,
            is_home,
            total_score
          )
        `
        )
        .in("status", ["scheduled", "in_progress"])
        .or(`created_by.eq.${user.id},game_participants.user_id.eq.${user.id}`)
        .order("date", { ascending: true })
        .limit(5);

      // 統計データの計算
      const totalGames = recentGamesData?.length || 0;
      const totalTeams = teamsData?.length || 0;

      setDashboardData({
        teams:
          teamsData?.map((tm) => ({
            id: tm.teams.id,
            name: tm.teams.name,
            member_count: tm.teams.team_members?.length || 0,
            user_role: tm.role,
          })) || [],
        recentGames: recentGamesData || [],
        upcomingGames: upcomingGamesData || [],
        stats: {
          totalGames,
          wins: 0, // 勝利数は後で計算
          totalTeams,
        },
      });
    } catch (error) {
      console.error("ダッシュボードデータ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ウェルカムセクション */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            おかえりなさい、
            {profile?.display_name || user?.email?.split("@")[0]}さん
          </h1>
          <p className="text-gray-600">今日も野球を楽しみましょう！</p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  参加した試合
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.totalGames}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">所属チーム</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.totalTeams}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
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
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">今週の試合</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.upcomingGames.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/games/create">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 cursor-pointer">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold">試合作成</h3>
                  <p className="text-blue-100 text-sm">新しい試合を企画</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/teams">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 cursor-pointer">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold">チーム管理</h3>
                  <p className="text-green-100 text-sm">チーム作成・参加</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/games">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 cursor-pointer">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold">試合履歴</h3>
                  <p className="text-purple-100 text-sm">過去の試合確認</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/search/teams">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 cursor-pointer">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold">チーム検索</h3>
                  <p className="text-orange-100 text-sm">新しいチーム発見</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* マイチーム */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">マイチーム</h3>
              <Link
                href="/teams"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                すべて見る →
              </Link>
            </div>
            {dashboardData.teams.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 mt-2">
                  チームがありません
                </h4>
                <p className="text-gray-500 text-sm mt-1">
                  新しいチームを作成しましょう
                </p>
                <Link
                  href="/teams"
                  className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  チームを作成
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.teams.slice(0, 3).map((team) => (
                  <Link key={team.id} href={`/teams/${team.id}`}>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {team.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {team.member_count}人 •{" "}
                          {team.user_role === "owner"
                            ? "オーナー"
                            : team.user_role === "manager"
                            ? "マネージャー"
                            : "プレイヤー"}
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
                {dashboardData.teams.length > 3 && (
                  <div className="text-center pt-2">
                    <Link
                      href="/teams"
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      他 {dashboardData.teams.length - 3} チームを見る
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 今後の試合 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">今後の試合</h3>
              <Link
                href="/games?filter=upcoming"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                すべて見る →
              </Link>
            </div>
            {dashboardData.upcomingGames.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 mt-2">
                  予定された試合がありません
                </h4>
                <p className="text-gray-500 text-sm mt-1">
                  新しい試合を作成しましょう
                </p>
                <Link
                  href="/games/create"
                  className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  試合を作成
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.upcomingGames.slice(0, 3).map((game) => (
                  <Link key={game.id} href={`/games/${game.id}`}>
                    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">
                          {game.title}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            game.status === "scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : game.status === "in_progress"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {game.status === "scheduled"
                            ? "予定"
                            : game.status === "in_progress"
                            ? "進行中"
                            : game.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>
                          {new Date(game.date).toLocaleDateString("ja-JP")}{" "}
                          {game.start_time || ""}
                        </p>
                        <p>{game.venue}</p>
                        {game.participants.length >= 2 && (
                          <p className="mt-1">
                            {game.participants[0].participant_name} vs{" "}
                            {game.participants[1].participant_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
                {dashboardData.upcomingGames.length > 3 && (
                  <div className="text-center pt-2">
                    <Link
                      href="/games?filter=upcoming"
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      他 {dashboardData.upcomingGames.length - 3} 試合を見る
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 最近の試合結果 */}
        {dashboardData.recentGames.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                最近の試合結果
              </h3>
              <Link
                href="/games?filter=completed"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                すべて見る →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.recentGames.slice(0, 3).map((game) => (
                <Link key={game.id} href={`/games/${game.id}`}>
                  <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900 truncate">
                        {game.title}
                      </h4>
                      <span className="bg-green-100 text-green-800 px-2 py-1 text-xs font-medium rounded-full">
                        完了
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      <p>{new Date(game.date).toLocaleDateString("ja-JP")}</p>
                      <p>{game.venue}</p>
                    </div>
                    {game.participants.length >= 2 && (
                      <div className="space-y-2">
                        {game.participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="flex justify-between items-center"
                          >
                            <span
                              className={`text-sm ${
                                participant.is_home
                                  ? "text-blue-600"
                                  : "text-red-600"
                              }`}
                            >
                              {participant.participant_name}{" "}
                              {participant.is_home ? "(後)" : "(先)"}
                            </span>
                            <span className="font-bold text-lg">
                              {participant.total_score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
