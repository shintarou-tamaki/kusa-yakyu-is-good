"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface PitchingStats {
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

interface Props {
  gameId: string;
}

export default function PitchingStatsDisplay({ gameId }: Props) {
  const supabase = createClientComponentClient();
  const [pitchingStats, setPitchingStats] = useState<PitchingStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPitchingStats();
  }, [gameId]);

  const fetchPitchingStats = async () => {
    try {
      const { data, error } = await supabase
        .from("player_pitching_stats")
        .select("*")
        .eq("game_id", gameId);

      if (error) throw error;
      if (data) {
        setPitchingStats(data);
      }
    } catch (error) {
      console.error("投手成績取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatInningsPitched = (innings: number) => {
  // 小数点第一位まで表示（0.1=1アウト、0.2=2アウト）
  if (innings % 1 === 0) {
    return `${innings}`;
  }
  return innings.toFixed(1);
};

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  if (pitchingStats.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">投手成績がまだ登録されていません</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          投手成績
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 px-2 font-medium">選手名</th>
                <th className="text-center py-2 px-2 font-medium">投球回</th>
                <th className="text-center py-2 px-2 font-medium">被安打</th>
                <th className="text-center py-2 px-2 font-medium">失点</th>
                <th className="text-center py-2 px-2 font-medium">自責点</th>
                <th className="text-center py-2 px-2 font-medium">奪三振</th>
                <th className="text-center py-2 px-2 font-medium">与四球</th>
                <th className="text-center py-2 px-2 font-medium">被本塁打</th>
                <th className="text-center py-2 px-2 font-medium">防御率</th>
                <th className="text-center py-2 px-2 font-medium">WHIP</th>
              </tr>
            </thead>
            <tbody>
              {pitchingStats.map((stats, index) => (
  <tr key={`${stats.player_id}-${index}`} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium">{stats.player_name}</td>
                  <td className="text-center py-2 px-2">
                    {formatInningsPitched(stats.innings_pitched)}
                  </td>
                  <td className="text-center py-2 px-2">{stats.hits_allowed}</td>
                  <td className="text-center py-2 px-2">{stats.runs_allowed}</td>
                  <td className="text-center py-2 px-2">{stats.earned_runs}</td>
                  <td className="text-center py-2 px-2">{stats.strikeouts}</td>
                  <td className="text-center py-2 px-2">{stats.walks}</td>
                  <td className="text-center py-2 px-2">{stats.home_runs_allowed}</td>
                  <td className="text-center py-2 px-2 font-semibold">
                    {stats.era.toFixed(2)}
                  </td>
                  <td className="text-center py-2 px-2">
                    {stats.whip.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 統計情報の説明 */}
        <div className="mt-4 pt-4 border-t text-xs text-gray-600">
          <div className="space-y-1">
            <div>
              <span className="font-medium">防御率 (ERA)</span>: 
              9イニングあたりの自責点 (低いほど良い)
            </div>
            <div>
              <span className="font-medium">WHIP</span>: 
              1イニングあたりの与四球＋被安打 (低いほど良い)
            </div>
          </div>
        </div>

        {/* チーム合計 */}
        {pitchingStats.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-2">チーム合計</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
  <span className="text-gray-600">投球回: </span>
  <span className="font-medium">
    {formatInningsPitched(
      (() => {
        // 各投手の投球回を実際のアウト数に変換して合計
        let totalOuts = 0;
        pitchingStats.forEach(s => {
          const wholeInnings = Math.floor(s.innings_pitched);
          const outs = Math.round((s.innings_pitched - wholeInnings) * 10);
          totalOuts += (wholeInnings * 3) + outs;
        });
        // アウト数を投球回表記に戻す
        const innings = Math.floor(totalOuts / 3);
        const remainingOuts = totalOuts % 3;
        return innings + (remainingOuts / 10);
      })()
    )}
  </span>
</div>
              <div>
                <span className="text-gray-600">奪三振: </span>
                <span className="font-medium">
                  {pitchingStats.reduce((sum, s) => sum + s.strikeouts, 0)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">与四球: </span>
                <span className="font-medium">
                  {pitchingStats.reduce((sum, s) => sum + s.walks, 0)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">失点: </span>
                <span className="font-medium">
                  {pitchingStats.reduce((sum, s) => sum + s.runs_allowed, 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}