import { SupabaseClient } from '@supabase/supabase-js';

// ランナー進塁ロジック
export async function advanceRunners(
  supabase: SupabaseClient,
  gameId: string,
  inning: number,
  batterBaseReached: number,
  batterId: string
) {
  if (batterBaseReached <= 0) return;

  const { data: currentRunners } = await supabase
    .from("game_runners")
    .select("*")
    .eq("game_id", gameId)
    .eq("inning", inning)
    .eq("is_active", true)
    .order("current_base", { ascending: false });

  if (!currentRunners || currentRunners.length === 0) return;

  const basesOccupied = new Set(currentRunners.map((r) => r.current_base));

  for (const runner of currentRunners) {
    let newBase = runner.current_base;

    if (batterBaseReached === 1) {
      if (runner.current_base === 1) {
        newBase = 2;
      } else if (runner.current_base === 2 && basesOccupied.has(1)) {
        newBase = 3;
      } else if (
        runner.current_base === 3 &&
        basesOccupied.has(2) &&
        basesOccupied.has(1)
      ) {
        newBase = 4;
      }
    } else if (batterBaseReached === 2) {
      newBase = Math.min(runner.current_base + 2, 4);
    } else if (batterBaseReached === 3) {
      newBase = 4;
    } else if (batterBaseReached === 4) {
      newBase = 4;
    }

    if (newBase !== runner.current_base) {
      if (newBase === 4) {
        await supabase
          .from("game_runners")
          .update({ current_base: 4, is_active: false })
          .eq("id", runner.id);

        await supabase
          .from("game_batting_records")
          .update({ run_scored: true })
          .eq("game_id", gameId)
          .eq("player_id", runner.player_id)
          .eq("inning", inning);
      } else {
        await supabase
          .from("game_runners")
          .update({ current_base: newBase })
          .eq("id", runner.id);
      }
    }
  }
}

// 打撃結果からbase_reached計算
export function calculateBaseReached(result: string): number {
  const baseReachedMap: Record<string, number> = {
    "安打": 1,
    "二塁打": 2,
    "三塁打": 3,
    "本塁打": 4,
    "四球": 1,
    "死球": 1,
    "エラー": 1,
    "野選": 1,
    "三振": 0,
    "ゴロ": 0,
    "フライ": 0,
    "ライナー": 0,
    "犠打": 0,
    "犠飛": 0,
    "フィールダースチョイス": 0,
  };
  
  return baseReachedMap[result] || 0;
}

// アウトになる打撃結果の判定
export function isOutResult(result: string): boolean {
  const outResults = [
    "三振", "ゴロ", "フライ", "ライナー", 
    "犠打", "犠飛", "フィールダースチョイス"
  ];
  return outResults.includes(result);
}