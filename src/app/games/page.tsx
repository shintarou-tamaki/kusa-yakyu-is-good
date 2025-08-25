"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";

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
  category?: "official" | "practice" | "scrimmage";
  teams?: {
    name: string;
  };
  record_type: string;
  created_by: string;
  attendance_check_enabled: boolean;
}

interface MyAttendanceStatus {
  status: "attending" | "absent" | "pending" | null;
  teamMemberId: string | null;
}

interface AttendanceCount {
  attending: number;
  total: number;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [myAttendanceStatuses, setMyAttendanceStatuses] = useState<Record<string, MyAttendanceStatus>>({});
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, AttendanceCount>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (user) {
      fetchGames();
    }
  }, [user]);

  const fetchGames = async () => {
    try {
      // ユーザーが作成した試合を取得
      const { data: createdGames, error: createdError } = await supabase
        .from("games")
        .select(
          `
          *,
          teams:home_team_id(name)
        `
        )
        .eq("created_by", user?.id)
        .order("game_date", { ascending: false });

      if (createdError) throw createdError;

      // ユーザーが所属するチームの試合を取得
      const { data: teamMemberships, error: membershipError } = await supabase
        .from("team_members")
        .select("team_id, id")
        .eq("user_id", user?.id);

      if (membershipError) throw membershipError;

      const teamIds = teamMemberships?.map((m) => m.team_id) || [];
      const teamMemberIds = teamMemberships?.map((m) => m.id) || [];

      // チームオーナーとして所有するチームのIDも追加
      const { data: ownedTeams, error: ownedError } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", user?.id);

      if (ownedError) throw ownedError;

      if (ownedTeams) {
        teamIds.push(...ownedTeams.map((t) => t.id));
      }

      // チームの試合を取得
      let teamGames: Game[] = [];
      if (teamIds.length > 0) {
        const { data, error: teamGamesError } = await supabase
          .from("games")
          .select(
            `
            *,
            teams:home_team_id(name)
          `
          )
          .in("home_team_id", teamIds)
          .order("game_date", { ascending: false });

        if (teamGamesError) throw teamGamesError;
        teamGames = data || [];
      }

      // 重複を除いて結合
      const allGames = [...(createdGames || []), ...teamGames];
      const uniqueGames = Array.from(
        new Map(allGames.map((game) => [game.id, game])).values()
      );

      setGames(uniqueGames);

      // 出欠確認が有効な試合の自分の出欠状態と参加人数を取得
      await fetchMyAttendanceStatuses(uniqueGames.filter(g => g.attendance_check_enabled), teamMemberIds);
      await fetchAttendanceCounts(uniqueGames.filter(g => g.attendance_check_enabled));
    } catch (error) {
      console.error("試合の取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAttendanceStatuses = async (gamesWithAttendance: Game[], teamMemberIds: string[]) => {
    if (gamesWithAttendance.length === 0 || teamMemberIds.length === 0) return;

    const gameIds = gamesWithAttendance.map(g => g.id);
    
    try {
      const { data, error } = await supabase
        .from("game_attendances")
        .select("game_id, status, team_member_id")
        .in("game_id", gameIds)
        .in("team_member_id", teamMemberIds);

      if (error) throw error;

      // 試合ごとに自分のステータスを設定
      const statuses: Record<string, MyAttendanceStatus> = {};
      
      gamesWithAttendance.forEach(game => {
        const myAttendance = data?.find(a => a.game_id === game.id);
        
        statuses[game.id] = {
          status: myAttendance?.status || null,
          teamMemberId: myAttendance?.team_member_id || null
        };
      });

      setMyAttendanceStatuses(statuses);
    } catch (error) {
      console.error("出欠状態の取得エラー:", error);
    }
  };

  const fetchAttendanceCounts = async (gamesWithAttendance: Game[]) => {
    if (gamesWithAttendance.length === 0) return;

    const gameIds = gamesWithAttendance.map(g => g.id);
    
    try {
      const { data, error } = await supabase
        .from("game_attendances")
        .select("game_id, status")
        .in("game_id", gameIds);

      if (error) throw error;

      // 試合ごとに参加人数を集計
      const counts: Record<string, AttendanceCount> = {};
      
      gamesWithAttendance.forEach(game => {
        const gameAttendances = data?.filter(a => a.game_id === game.id) || [];
        
        counts[game.id] = {
          attending: gameAttendances.filter(a => a.status === "attending").length,
          total: gameAttendances.length
        };
      });

      setAttendanceCounts(counts);
    } catch (error) {
      console.error("参加人数の取得エラー:", error);
    }
  };

  const handleDelete = async (gameId: string) => {
    if (!confirm("この試合を削除してもよろしいですか？\n関連するすべてのデータが削除されます。")) {
      return;
    }

    setDeleting(gameId);
    
    try {
      // 関連データを先に削除
      // 1. 出欠確認データ
      await supabase.from("game_attendances").delete().eq("game_id", gameId);
      
      // 2. ランナー情報
      await supabase.from("game_runners").delete().eq("game_id", gameId);
      
      // 3. 打撃記録
      await supabase.from("game_batting_records").delete().eq("game_id", gameId);
      
      // 4. 投手記録
      await supabase.from("game_pitching_records").delete().eq("game_id", gameId);
      
      // 5. 選手交代記録
      await supabase.from("game_substitutions").delete().eq("game_id", gameId);
      
      // 6. 選手データ
      await supabase.from("game_players").delete().eq("game_id", gameId);
      
      // 7. スコアデータ
      await supabase.from("game_scores").delete().eq("game_id", gameId);
      
      // 8. 運営タスク
      await supabase.from("game_operation_tasks").delete().eq("game_id", gameId);
      
      // 9. 最後に試合データを削除
      const { error } = await supabase
        .from("games")
        .delete()
        .eq("id", gameId);

      if (error) throw error;

      // リストから削除
      setGames(games.filter(g => g.id !== gameId));
      
      // 出欠状態も削除
      const newStatuses = { ...myAttendanceStatuses };
      delete newStatuses[gameId];
      setMyAttendanceStatuses(newStatuses);
      
      const newCounts = { ...attendanceCounts };
      delete newCounts[gameId];
      setAttendanceCounts(newCounts);
      
      alert("試合を削除しました");
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  const getMyAttendanceDisplay = (gameId: string) => {
    const myStatus = myAttendanceStatuses[gameId];
    if (!myStatus || !myStatus.status) return null;

    switch (myStatus.status) {
      case "attending":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            出席
          </span>
        );
      case "absent":
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
            欠席
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full animate-pulse">
            ⚠️ 未回答
          </span>
        );
      default:
        return null;
    }
  };

  const getParticipantCount = (gameId: string) => {
    const count = attendanceCounts[gameId];
    if (!count) return null;

    const attending = count.attending;
    const isAlert = attending < 9;

    return (
      <div className={`font-semibold ${isAlert ? 'text-red-600' : 'text-gray-900'}`}>
        {attending}人
        {isAlert && (
          <span className="ml-1 text-xs">
            (要追加募集)
          </span>
        )}
      </div>
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">試合管理</h1>
          <Link
            href="/games/create"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            新規試合作成
          </Link>
        </div>

        {/* 試合一覧 */}
        {games.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">試合がまだありません</p>
            <Link
              href="/games/create"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              最初の試合を作成
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    試合名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  カテゴリー
</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日付
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    対戦相手
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    スコア
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    出欠回答
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    参加人数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {games.map((game) => (
                  <tr key={game.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/games/${game.id}?from=management`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {game.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
  {game.category ? (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
      game.category === 'official' 
        ? 'bg-red-100 text-red-800'
        : game.category === 'practice'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-green-100 text-green-800'
    }`}>
      {game.category === 'official' ? '公式戦' 
        : game.category === 'practice' ? '練習試合' 
        : '紅白戦'}
    </span>
  ) : (
    <span className="text-gray-400 text-xs">-</span>
  )}
</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(game.game_date).toLocaleDateString("ja-JP")}
                      {game.game_time && ` ${game.game_time}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {game.opponent_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {game.status === "completed" || game.status === "in_progress"
                        ? `${game.home_score} - ${game.opponent_score}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${
                          game.status === "scheduled"
                            ? "bg-gray-100 text-gray-800"
                            : game.status === "in_progress"
                            ? "bg-yellow-100 text-yellow-800"
                            : game.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {game.status === "scheduled"
                          ? "予定"
                          : game.status === "in_progress"
                          ? "進行中"
                          : game.status === "completed"
                          ? "終了"
                          : "中止"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {game.attendance_check_enabled ? (
                        getMyAttendanceDisplay(game.id) || (
                          <span className="text-gray-400 text-xs">-</span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {game.attendance_check_enabled ? (
                        getParticipantCount(game.id)
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {game.created_by === user?.id && (
                        <button
                          onClick={() => handleDelete(game.id)}
                          disabled={deleting === game.id}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleting === game.id ? "削除中..." : "削除"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}