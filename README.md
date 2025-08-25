# プロジェクト情報
- リポジトリ: [URL]
- 技術スタック: Next.js 14, Supabase, TypeScript
- 現在の状態: [project_state.mdを添付]

# 要求仕様
## ビジネスロジック
1. チーム作成時、作成者は自動的にownerとしてteam_membersに登録される
2. 完了した試合は誰でも閲覧可能
3. チームメンバーのみ予定試合を閲覧可能
4. [その他の要件]

## 現在の問題
1. [具体的な問題]
2. [エラーメッセージ]

## 期待する動作
1. [具体的な期待動作]

# 制約事項
- 部分的な修正ではなく、全体の整合性を保つこと
- 既存のデータを破壊しないこと
- RLSポリシーの無限再帰を避けること


[
  {
    "テーブル名": "game_attendances",
    "ポリシー名": "Team members can create attendance",
    "操作": "INSERT",
    "条件": null
  },
  {
    "テーブル名": "game_attendances",
    "ポリシー名": "Team members can view attendances",
    "操作": "SELECT",
    "条件": "(game_id IN ( SELECT g.id\n   FROM (games g\n     JOIN team_members tm ON ((g.home_team_id = tm.team_id)))\n  WHERE (tm.user_id = auth.uid())))"
  },
  {
    "テーブル名": "game_attendances",
    "ポリシー名": "Members can update own attendance",
    "操作": "UPDATE",
    "条件": "(team_member_id IN ( SELECT team_members.id\n   FROM team_members\n  WHERE (team_members.user_id = auth.uid())))"
  },
  {
    "テーブル名": "game_batting_records",
    "ポリシー名": "batting_records_all_policy",
    "操作": "ALL",
    "条件": "(game_id IN ( SELECT g.id\n   FROM ((games g\n     LEFT JOIN teams t ON ((g.home_team_id = t.id)))\n     LEFT JOIN team_members tm ON ((t.id = tm.team_id)))\n  WHERE ((g.created_by = auth.uid()) OR (t.owner_id = auth.uid()) OR (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "game_batting_records",
    "ポリシー名": "batting_records_select_policy",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "game_operation_tasks",
    "ポリシー名": "チームメンバーは運営タスクを管理可能",
    "操作": "ALL",
    "条件": "(EXISTS ( SELECT 1\n   FROM (games g\n     JOIN team_members tm ON ((tm.team_id = g.home_team_id)))\n  WHERE ((g.id = game_operation_tasks.game_id) AND (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "game_operation_tasks",
    "ポリシー名": "誰でも運営タスクを閲覧可能",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "game_pitching_records",
    "ポリシー名": "pitching_records_all_policy",
    "操作": "ALL",
    "条件": "(game_id IN ( SELECT g.id\n   FROM ((games g\n     LEFT JOIN teams t ON ((g.home_team_id = t.id)))\n     LEFT JOIN team_members tm ON ((t.id = tm.team_id)))\n  WHERE ((g.created_by = auth.uid()) OR (t.owner_id = auth.uid()) OR (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "game_pitching_records",
    "ポリシー名": "pitching_records_select_policy",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "game_players",
    "ポリシー名": "game_players_all_policy",
    "操作": "ALL",
    "条件": "(game_id IN ( SELECT g.id\n   FROM ((games g\n     LEFT JOIN teams t ON ((g.home_team_id = t.id)))\n     LEFT JOIN team_members tm ON ((t.id = tm.team_id)))\n  WHERE ((g.created_by = auth.uid()) OR (t.owner_id = auth.uid()) OR (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "game_players",
    "ポリシー名": "game_players_select_policy",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "game_runners",
    "ポリシー名": "game_runners_modify_policy",
    "操作": "ALL",
    "条件": "(EXISTS ( SELECT 1\n   FROM (games g\n     JOIN team_members tm ON ((tm.team_id = g.home_team_id)))\n  WHERE ((g.id = game_runners.game_id) AND (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "game_runners",
    "ポリシー名": "game_runners_select_policy",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "game_scores",
    "ポリシー名": "Game owners can manage scores",
    "操作": "ALL",
    "条件": "(game_id IN ( SELECT games.id\n   FROM games\n  WHERE ((games.created_by = auth.uid()) OR (games.home_team_id IN ( SELECT teams.id\n           FROM teams\n          WHERE (teams.owner_id = auth.uid()))))))"
  },
  {
    "テーブル名": "game_scores",
    "ポリシー名": "Game scores are viewable by everyone",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "game_substitutions",
    "ポリシー名": "substitutions_all_policy",
    "操作": "ALL",
    "条件": "(game_id IN ( SELECT g.id\n   FROM ((games g\n     LEFT JOIN teams t ON ((g.home_team_id = t.id)))\n     LEFT JOIN team_members tm ON ((t.id = tm.team_id)))\n  WHERE ((g.created_by = auth.uid()) OR (t.owner_id = auth.uid()) OR (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "game_substitutions",
    "ポリシー名": "substitutions_select_policy",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "games",
    "ポリシー名": "Users can delete their own games",
    "操作": "DELETE",
    "条件": "(created_by = auth.uid())"
  },
  {
    "テーブル名": "games",
    "ポリシー名": "Authenticated users can create games",
    "操作": "INSERT",
    "条件": null
  },
  {
    "テーブル名": "games",
    "ポリシー名": "Public games are viewable by everyone",
    "操作": "SELECT",
    "条件": "(is_public = true)"
  },
  {
    "テーブル名": "games",
    "ポリシー名": "Users can view their own games",
    "操作": "SELECT",
    "条件": "(created_by = auth.uid())"
  },
  {
    "テーブル名": "games",
    "ポリシー名": "Users can update their own games",
    "操作": "UPDATE",
    "条件": "(created_by = auth.uid())"
  },
  {
    "テーブル名": "team_default_lineup",
    "ポリシー名": "Team members can manage default lineup",
    "操作": "ALL",
    "条件": "(team_id IN ( SELECT t.id\n   FROM (teams t\n     LEFT JOIN team_members tm ON ((t.id = tm.team_id)))\n  WHERE ((t.owner_id = auth.uid()) OR (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "team_default_lineup",
    "ポリシー名": "Team members can view default lineup",
    "操作": "SELECT",
    "条件": "(team_id IN ( SELECT t.id\n   FROM (teams t\n     LEFT JOIN team_members tm ON ((t.id = tm.team_id)))\n  WHERE ((t.owner_id = auth.uid()) OR (tm.user_id = auth.uid()))))"
  },
  {
    "テーブル名": "team_join_requests",
    "ポリシー名": "Delete own pending requests",
    "操作": "DELETE",
    "条件": "((user_id = auth.uid()) AND ((status)::text = 'pending'::text))"
  },
  {
    "テーブル名": "team_join_requests",
    "ポリシー名": "Anyone can create join requests",
    "操作": "INSERT",
    "条件": null
  },
  {
    "テーブル名": "team_join_requests",
    "ポリシー名": "View own requests or team requests",
    "操作": "SELECT",
    "条件": "((user_id = auth.uid()) OR (team_id IN ( SELECT teams.id\n   FROM teams\n  WHERE (teams.owner_id = auth.uid()))))"
  },
  {
    "テーブル名": "team_join_requests",
    "ポリシー名": "Team owners update requests",
    "操作": "UPDATE",
    "条件": "(EXISTS ( SELECT 1\n   FROM teams\n  WHERE ((teams.id = team_join_requests.team_id) AND (teams.owner_id = auth.uid()))))"
  },
  {
    "テーブル名": "team_members",
    "ポリシー名": "Members can leave teams",
    "操作": "DELETE",
    "条件": "(user_id = auth.uid())"
  },
  {
    "テーブル名": "team_members",
    "ポリシー名": "Team owners add members",
    "操作": "INSERT",
    "条件": null
  },
  {
    "テーブル名": "team_members",
    "ポリシー名": "Anyone can view members",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "teams",
    "ポリシー名": "Owners can delete their teams",
    "操作": "DELETE",
    "条件": "(auth.uid() = owner_id)"
  },
  {
    "テーブル名": "teams",
    "ポリシー名": "Authenticated users can create teams",
    "操作": "INSERT",
    "条件": null
  },
  {
    "テーブル名": "teams",
    "ポリシー名": "Anyone can view teams",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "teams",
    "ポリシー名": "Owners can update their teams",
    "操作": "UPDATE",
    "条件": "(auth.uid() = owner_id)"
  },
  {
    "テーブル名": "user_profiles",
    "ポリシー名": "allow_create_own_profile",
    "操作": "INSERT",
    "条件": null
  },
  {
    "テーブル名": "user_profiles",
    "ポリシー名": "allow_read_profiles",
    "操作": "SELECT",
    "条件": "true"
  },
  {
    "テーブル名": "user_profiles",
    "ポリシー名": "allow_update_own_profile",
    "操作": "UPDATE",
    "条件": "(auth.uid() = id)"
  }
]