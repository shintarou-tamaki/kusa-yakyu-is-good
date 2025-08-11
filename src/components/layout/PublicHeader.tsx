function PublicHeader() {
  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴ・ナビゲーション */}
          <div className="flex items-center space-x-8">
            <a href="/" className="flex items-center space-x-2">
              <span className="text-2xl">⚾️</span>
              <span className="text-xl font-bold text-gray-900">草野球スコア</span>
            </a>
            
            <nav className="hidden md:flex space-x-6">
              <a href="/search/games" className="text-gray-600 hover:text-gray-900 transition-colors">
                試合検索
              </a>
              <a href="/search/teams" className="text-gray-600 hover:text-gray-900 transition-colors">
                チーム検索
              </a>
            </nav>
          </div>

          {/* ログインボタン */}
          <div className="flex items-center space-x-2">
            <a
              href="/login"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              ログイン
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}