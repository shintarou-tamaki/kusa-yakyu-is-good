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
  owner_id: string;
}

interface TeamWithRole extends Team {
  role: 'owner' | 'member';
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // ユーザーがログインしている場合のみチームを取得
    if (user) {
      fetchTeams();
    }
  }, [user]);

  const fetchTeams = async () => {
    try {
      const allTeams: TeamWithRole[] = [];
      const teamIds = new Set<string>();

      // 1. ユーザーが所有するチームを取得
      const { data: ownedTeams, error: ownedError } = await supabase
        .from("teams")
        .select("*")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (ownedError) {
        console.error("所有チーム取得エラー:", ownedError);
      } else if (ownedTeams) {
        ownedTeams.forEach(team => {
          if (!teamIds.has(team.id)) {
            allTeams.push({
              ...team,
              role: 'owner'
            });
            teamIds.add(team.id);
          }
        });
      }

      // 2. メンバーとして所属するチームを取得
      const { data: memberData, error: memberError } = await supabase
        .from("team_members")
        .select(`
          team_id,
          role,
          teams:team_id (
            id,
            name,
            description,
            created_at,
            owner_id
          )
        `)
        .eq("user_id", user?.id);

      if (memberError) {
        console.error("所属チーム取得エラー:", memberError);
      } else if (memberData) {
        memberData.forEach(member => {
          const team = member.teams as unknown as Team;
          if (team && !teamIds.has(team.id)) {
            allTeams.push({
              ...team,
              role: 'member'
            });
            teamIds.add(team.id);
          }
        });
      }

      // 作成日でソート
      allTeams.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTeams(allTeams);
    } catch (error) {
      console.error("チーム取得エラー:", error);
      setTeams([]);
    } finally {
      setLoading(false);
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">マイチーム</h1>
            <p className="text-gray-600 mt-1">
              所属チーム数: {teams.length}
            </p>
          </div>
          <div className="flex space-x-2">
            <Link
              href="/search/teams"
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              チームを探す
            </Link>
            <Link
              href="/teams/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              新しいチームを作成
            </Link>
          </div>
        </div>

        {/* チーム一覧 */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              チームがありません
            </h3>
            <p className="text-gray-500 mb-4">
              最初のチームを作成して、仲間を招待しましょう
            </p>
            <div className="space-y-2">
              <Link
                href="/teams/create"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                チームを作成
              </Link>
              <div className="mt-2">
                <Link
                  href="/search/teams"
                  className="text-blue-600 hover:text-blue-700"
                >
                  既存のチームを探す →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {team.name}
                    </h3>
                    {team.role === 'owner' && (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        オーナー
                      </span>
                    )}
                    {team.role === 'member' && (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                        メンバー
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {team.description || "チームの説明はありません"}
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <svg
                    className="w-4 h-4 mr-1"
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
                  {new Date(team.created_at).toLocaleDateString("ja-JP")}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}