import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // 認証コードをセッショントークンに交換
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // ユーザー情報を取得
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // user_profilesの存在確認
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();

        // プロフィールが存在しない、またはdisplay_nameが未設定の場合
        if (!profile || !profile.display_name || profile.display_name === "ユーザー") {
          // 初回ログインまたはユーザー名未設定の場合は、ユーザー名設定ページへ
          return NextResponse.redirect(new URL("/profile/setup", requestUrl.origin));
        }
        
        // ユーザー名が設定済みの場合は、ダッシュボードへリダイレクト
        return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
      }
    }
  }

  // エラーの場合はログインページへ
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}