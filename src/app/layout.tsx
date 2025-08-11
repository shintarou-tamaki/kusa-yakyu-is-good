// app/layout.tsx - ルートレイアウト
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Header } from '@/components/layout/Header'

export const metadata = {
  title: '草野球スコア',
  description: '草野球の試合管理・スコア入力アプリケーション',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50">
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}