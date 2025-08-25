"use client";

import { use, useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeamMemberStats from "@/components/stats/TeamMemberStats";
import TeamOperationStats from "@/components/stats/TeamOperationStats";

interface Team {
  id: string;
  name: string;
  description: string | null;
  prefecture: string | null;
  city: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_profiles: {
    id: string;
    display_name: string | null;
  } | null;
}

interface JoinRequest {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  requested_at: string;
  user_profiles?: {
    id: string;
    display_name: string | null;
  };
}

interface Game {
  id: string;
  name: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  opponent_name: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  home_score: number;
  opponent_score: number;
}

interface PageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default function TeamDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const teamId = resolvedParams.teamId;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [completedGames, setCompletedGames] = useState<Game[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [hasRequestPending, setHasRequestPending] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (teamId) {
      fetchTeamData();
    }
  }, [teamId, user]);

  const fetchTeamData = async () => {
    try {
      // チーム情報を取得
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamError || !teamData) {
        console.error("チーム取得エラー:", teamError);
        router.push("/teams");
        return;
      }

      setTeam(teamData);

      // 完了した試合を取得（全員閲覧可能）
      const { data: completedData } = await supabase
        .from("games")
        .select("*")
        .eq("home_team_id", teamId)
        .eq("status", "completed")
        .order("game_date", { ascending: false })
        .limit(5);

      if (completedData) {
        setCompletedGames(completedData);
      }

      // ログインしている場合のみ、メンバー情報や参加申請を取得
      if (user) {
        setIsOwner(teamData.owner_id === user.id);

        // メンバーかどうかチェック
        const { data: memberCheck } = await supabase
          .from("team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("user_id", user.id)
          .single();

        const isTeamMember = !!memberCheck || teamData.owner_id === user.id;
        setIsMember(isTeamMember);

        // メンバーリストを取得（オーナーも含む）
        if (isTeamMember) {
          // まずメンバー情報を取得
          const { data: membersData, error: membersError } = await supabase
            .from("team_members")
            .select("*")
            .eq("team_id", teamId)
            .order("joined_at", { ascending: true });

          console.log("メンバー取得結果:", membersData);
          console.log("メンバー取得エラー:", membersError);

          if (membersData) {
            // メンバーのuser_idリストを作成
            const userIds = membersData.map((m) => m.user_id);

            // user_profilesを別途取得（usernameフィールドを削除）
            const { data: profiles, error: profilesError } = await supabase
              .from("user_profiles")
              .select("id, display_name") // usernameを削除
              .in("id", userIds);

            console.log("プロファイル取得結果:", profiles);
            console.log("プロファイル取得エラー:", profilesError);

            // メンバー情報とプロファイルを結合
            const membersWithProfiles = membersData.map((member) => {
              const profile = profiles?.find((p) => p.id === member.user_id);
              return {
                ...member,
                user_profiles: profile || null,
              };
            });

            setMembers(membersWithProfiles);
          }

          // 今後の予定試合を取得
          const { data: upcomingData } = await supabase
            .from("games")
            .select("*")
            .eq("home_team_id", teamId)
            .eq("status", "scheduled")
            .gte("game_date", new Date().toISOString().split("T")[0])
            .order("game_date", { ascending: true })
            .limit(5);

          if (upcomingData) {
            setUpcomingGames(upcomingData);
          }
        }

        // オーナーの場合は参加申請を取得
        if (teamData.owner_id === user.id) {
          const { data: requestsData } = await supabase
            .from("team_join_requests")
            .select(
              `
              *,
              user_profiles!team_join_requests_user_id_fkey (
                id,
                display_name
              )
            `
            )
            .eq("team_id", teamId)
            .eq("status", "pending")
            .order("requested_at", { ascending: false });

          if (requestsData) {
            setJoinRequests(requestsData);
          }
        }

        // ユーザーが既に参加申請を送っているかチェック
        if (!isTeamMember) {
          const { data: existingRequest } = await supabase
            .from("team_join_requests")
            .select("id")
            .eq("team_id", teamId)
            .eq("user_id", user.id)
            .eq("status", "pending")
            .single();

          setHasRequestPending(!!existingRequest);
        }
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("team_join_requests").insert({
        team_id: teamId,
        user_id: user.id,
        message: joinMessage.trim() || null,
        status: "pending",
      });

      if (error) {
        console.error("参加申請エラー:", error);
        alert("参加申請の送信に失敗しました");
        return;
      }

      setHasRequestPending(true);
      setJoinMessage("");
      alert("参加申請を送信しました");
    } catch (error) {
      console.error("参加申請エラー:", error);
      alert("参加申請の送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    try {
      // 参加申請を承認
      const { error: updateError } = await supabase
        .from("team_join_requests")
        .update({
          status: "approved",
          responded_at: new Date().toISOString(),
          responded_by: user?.id,
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("承認エラー:", updateError);
        alert("承認に失敗しました");
        return;
      }

      // team_membersに追加
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          team_id: teamId,
          user_id: userId,
          role: "player",
        });

      if (memberError) {
        console.error("メンバー追加エラー:", memberError);
        alert("メンバー追加に失敗しました");
        return;
      }

      // リストを更新
      fetchTeamData();
      alert("参加申請を承認しました");
    } catch (error) {
      console.error("承認エラー:", error);
      alert("承認に失敗しました");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("team_join_requests")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
          responded_by: user?.id,
        })
        .eq("id", requestId);

      if (error) {
        console.error("却下エラー:", error);
        alert("却下に失敗しました");
        return;
      }

      // リストを更新
      setJoinRequests(joinRequests.filter((req) => req.id !== requestId));
      alert("参加申請を却下しました");
    } catch (error) {
      console.error("却下エラー:", error);
      alert("却下に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">チームが見つかりません</p>
          <Link href="/teams" className="text-blue-600 hover:text-blue-700">
            チーム一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link
            href="/teams"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            チーム一覧に戻る
          </Link>
        </div>

        {/* チーム情報 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {team.name}
              </h1>
              {(team.prefecture || team.city) && (
                <p className="text-sm text-gray-600 mb-2">
                  活動地域: {team.prefecture || ""} {team.city || ""}
                </p>
              )}
              <p className="text-gray-600">{team.description}</p>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <Link
                  href={`/teams/${teamId}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  チーム編集
                </Link>
                <Link
                  href={`/teams/${teamId}/games`}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  試合管理
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* メンバー一覧 */}
          {isMember && (
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  メンバー
                </h2>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex justify-between items-center py-2 border-b last:border-b-0"
                    >
                      <span className="text-gray-700">
                        {member.user_profiles?.display_name || "名前未設定"}
                      </span>
                      <span className="text-sm text-gray-500">
                        {member.role === "owner" ? "オーナー" : "メンバー"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 試合情報 */}
          <div className={isMember ? "lg:col-span-2" : "lg:col-span-3"}>
            {/* 予定試合（メンバーのみ） */}
            {isMember && upcomingGames.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    今後の予定
                  </h2>
                  <Link
                    href="/games/new"
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    新規試合作成 →
                  </Link>
                </div>
                <div className="space-y-3">
                  {upcomingGames.map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {game.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(game.game_date).toLocaleDateString(
                              "ja-JP"
                            )}{" "}
                            {game.game_time || ""}
                          </p>
                          <p className="text-sm text-gray-500">
                            vs {game.opponent_name}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 完了試合（全員閲覧可能） */}
            {completedGames.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  最近の試合結果
                </h2>
                <div className="space-y-3">
                  {completedGames.map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {game.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(game.game_date).toLocaleDateString(
                              "ja-JP"
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            vs {game.opponent_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={
                              game.home_score > game.opponent_score
                                ? "text-blue-600 font-bold"
                                : "text-gray-900"
                            }
                          >
                            {game.home_score}
                          </span>
                          <span className="mx-2 text-gray-400">-</span>
                          <span
                            className={
                              game.opponent_score > game.home_score
                                ? "text-red-600 font-bold"
                                : "text-gray-900"
                            }
                          >
                            {game.opponent_score}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 参加申請フォーム（非メンバー） */}
        {user && !isMember && !hasRequestPending && (
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              チーム参加申請
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メッセージ（任意）
                </label>
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="自己紹介やアピールポイントなど"
                />
              </div>
              <button
                onClick={handleJoinRequest}
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "送信中..." : "参加申請を送る"}
              </button>
            </div>
          </div>
        )}

        {/* 申請済みメッセージ */}
        {hasRequestPending && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700">
              参加申請を送信済みです。承認をお待ちください。
            </p>
          </div>
        )}

        {/* 参加申請一覧（オーナーのみ） */}
        {isOwner && joinRequests.length > 0 && (
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">参加申請</h2>
            <div className="space-y-4">
              {joinRequests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {request.user_profiles?.display_name || "名前未設定"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(request.requested_at).toLocaleDateString(
                          "ja-JP"
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleApproveRequest(request.id, request.user_id)
                        }
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        却下
                      </button>
                    </div>
                  </div>
                  {request.message && (
                    <p className="text-gray-600 mt-2">{request.message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* チーム運営貢献度セクション */}
        {isMember && (
          <div className="mb-8">
            <TeamOperationStats teamId={teamId} />
          </div>
        )}
        {/* チーム成績セクション */}
        {isMember && (
          <div className="mb-8">
            <TeamMemberStats teamId={teamId} />
          </div>
        )}
      </div>
    </div>
  );
}
