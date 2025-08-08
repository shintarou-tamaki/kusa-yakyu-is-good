import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import Link from "next/link";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
  variable: "--font-noto-sans-jp",
  display: "swap",
  fallback: ["Hiragino Sans", "Hiragino Kaku Gothic ProN", "sans-serif"],
});

export const metadata: Metadata = {
  title: "草野球 is Good 幸せな草野球チーム運営のためのwebサービス",
  description:
    "草野球 is Goodは、草野球チーム運営者が少しでも気持ちよくチーム運営するためのアプリです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={notoSans.variable}>
        <Header />
        <div className="p-10">{children}</div>
        <Footer />
        <ul className="p-10">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/search_teams">search_teams</Link>
          </li>
          <li>
            <Link href="/team-ditail">team-ditail</Link>
          </li>
          <li>
            <Link href="/game-list">game-list</Link>
          </li>
          <li>
            <Link href="/game-ditail">game-ditail</Link>
          </li>
        </ul>
      </body>
    </html>
  );
}
