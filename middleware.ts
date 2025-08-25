import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // セッションを取得
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 公開ページのパス（認証不要）
  const publicPaths = [
    "/",
    "/search/teams",
    "/search/games",
    "/login",
    "/auth/callback",
  ];

  // 公開ページのパターン（正規表現で判定）
  const publicPatterns = [
    /^\/teams\/[^\/]+$/, // /teams/[teamId]
    /^\/teams\/[^\/]+\/games$/, // /teams/[teamId]/games
    /^\/games\/[^\/]+$/, // /games/[gameId] - 試合詳細も公開
  ];

  // 保護されたルートの定義
  const protectedRoutes = [
    "/dashboard",
    "/teams/create",
    "/games/create",
    "/profile",
  ];

  // 保護されたパターン（編集・管理系）
  const protectedPatterns = [
    /^\/teams\/[^\/]+\/edit$/, // /teams/[teamId]/edit
    /^\/teams\/[^\/]+\/members$/, // /teams/[teamId]/members
    /^\/games\/[^\/]+\/edit$/, // /games/[gameId]/edit
    /^\/games\/[^\/]+\/score$/, // /games/[gameId]/score
  ];

  const isPublicPath =
    publicPaths.includes(req.nextUrl.pathname) ||
    publicPatterns.some((pattern) => pattern.test(req.nextUrl.pathname));

  const isProtectedRoute =
    protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route)) ||
    protectedPatterns.some((pattern) => pattern.test(req.nextUrl.pathname));

  // 認証が必要なページにアクセスしようとした場合
  if (isProtectedRoute && !isPublicPath && !session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    // リダイレクト後に元のページに戻れるように、元のURLを保存
    redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ログイン済みユーザーがホームページまたはログインページにアクセスした場合
  if (
    session &&
    (req.nextUrl.pathname === "/" || req.nextUrl.pathname === "/login")
  ) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// ミドルウェアを適用するパスの設定
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
