const fs = require("fs");
const path = require("path");

// 設定可能なオプション
const CONFIG = {
  OUTPUT_DIR: "split_source_files", // 出力ディレクトリ名
  USE_TIMESTAMP: false, // タイムスタンプ付きディレクトリにする場合はtrue
  CLEAN_BEFORE_GENERATE: true, // 生成前に既存ファイルをクリーンアップ
  GENERATE_SUMMARY: true, // サマリーファイルを生成するか
};

// ファイルを分類するための設定
const FILE_CATEGORIES = {
  auth_and_profile: {
    name: "認証・プロフィール機能",
    description:
      "Authentication, user profile management, and login functionality",
    patterns: [
      "src/app/auth/",
      "src/app/login/",
      "src/app/profile/",
      "src/components/auth/",
    ],
  },
  game_core: {
    name: "試合基本機能",
    description: "Core game management features",
    patterns: [
      "src/app/games/page.tsx",
      "src/app/games/create/",
      "src/app/games/\\[gameId\\]/page.tsx",
      "src/app/games/\\[gameId\\]/edit/",
      "src/app/games/\\[gameId\\]/score/",
    ],
  },
  game_advanced: {
    name: "試合詳細機能",
    description:
      "Advanced game features including progress, players, attendance",
    patterns: [
      "src/app/games/\\[gameId\\]/progress/",
      "src/app/games/\\[gameId\\]/players/",
      "src/app/games/\\[gameId\\]/attendance/",
      "src/app/games/\\[gameId\\]/operations/",
      "src/components/game/",
    ],
  },
  team_management: {
    name: "チーム管理機能",
    description: "Team management and related features",
    patterns: ["src/app/teams/", "src/components/team/"],
  },
  dashboard_search_stats: {
    name: "ダッシュボード・検索・統計機能",
    description: "Dashboard, search, and statistics features",
    patterns: [
      "src/app/dashboard/",
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/app/search/",
      "src/components/search/",
      "src/components/stats/",
    ],
  },
  ui_and_shared: {
    name: "UI・共有コンポーネント",
    description: "UI components and shared utilities",
    patterns: [
      "src/components/ui/",
      "src/components/Header.tsx",
      "src/components/Headline1.tsx",
      "src/lib/",
    ],
  },
};

// コメントを削除する関数
function removeComments(content) {
  // シングルラインコメントを削除
  content = content.replace(/\/\/.*$/gm, "");

  // マルチラインコメントを削除
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");

  // JSXコメントを削除
  content = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // 連続する空行を1つにまとめる
  content = content.replace(/\n\s*\n\s*\n/g, "\n\n");

  // 行末の空白を削除
  content = content.replace(/[ \t]+$/gm, "");

  return content.trim();
}

// ファイルがどのカテゴリに属するか判定
function categorizeFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
    for (const pattern of config.patterns) {
      const regex = new RegExp(pattern.replace(/\\/g, "\\\\"));
      if (regex.test(normalizedPath)) {
        return category;
      }
    }
  }

  // どのカテゴリにも該当しない場合は ui_and_shared に分類
  return "ui_and_shared";
}

// ディレクトリを再帰的に探索してファイルを取得
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// カテゴリごとのファイル内容を生成
function generateCategoryContent(category, files, timestamp) {
  const config = FILE_CATEGORIES[category];
  let content = `# ${config.name} Source Code\n`;
  content += `Generated at: ${timestamp}\n`;
  content += `File count: ${files.length} files\n`;
  content += `Purpose: ${config.description}\n\n`;

  files.forEach((filePath) => {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const cleanedContent = removeComments(fileContent);

    content += `${"=".repeat(80)}\n`;
    content += `FILE: ${filePath.replace(/\\/g, "/")}\n`;
    content += `${"=".repeat(80)}\n\n`;
    content += cleanedContent;
    content += "\n\n\n";
  });

  return content;
}

// メイン処理
function main() {
  console.log("機能別ソースファイル生成を開始します...");

  const timestamp = new Date().toISOString().split("T")[0];
  const categorizedFiles = {};

  // 出力ディレクトリの設定
  const OUTPUT_DIR = CONFIG.USE_TIMESTAMP
    ? `${CONFIG.OUTPUT_DIR}_${timestamp}`
    : CONFIG.OUTPUT_DIR;

  // 出力ディレクトリが存在しない場合は作成
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 出力ディレクトリを作成しました: ${OUTPUT_DIR}/\n`);
  } else {
    console.log(`📁 出力ディレクトリを使用します: ${OUTPUT_DIR}/`);

    // クリーンアップオプションが有効な場合
    if (CONFIG.CLEAN_BEFORE_GENERATE) {
      console.log(`🧹 既存のファイルをクリーンアップしています...`);
      const existingFiles = fs
        .readdirSync(OUTPUT_DIR)
        .filter((file) => file.endsWith(".txt"));
      existingFiles.forEach((file) => {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      });
      console.log(`   ${existingFiles.length}個のファイルを削除しました\n`);
    } else {
      console.log("");
    }
  }

  // カテゴリごとに空の配列を初期化
  Object.keys(FILE_CATEGORIES).forEach((category) => {
    categorizedFiles[category] = [];
  });

  // すべてのファイルを取得して分類
  const files = getAllFiles("./src");
  console.log(`総ファイル数: ${files.length}\n`);

  files.forEach((file) => {
    const category = categorizeFile(file);
    categorizedFiles[category].push(file);
  });

  // 生成統計
  let totalSize = 0;
  let fileCount = 0;

  // 各カテゴリのファイルを生成
  Object.entries(categorizedFiles).forEach(([category, files]) => {
    if (files.length > 0) {
      const content = generateCategoryContent(category, files, timestamp);
      const filename = `${category}.txt`;
      const filepath = path.join(OUTPUT_DIR, filename);

      fs.writeFileSync(filepath, content, "utf8");

      const fileSize = Buffer.byteLength(content, "utf8");
      totalSize += fileSize;
      fileCount++;

      console.log(`✅ ${filename} を作成しました`);
      console.log(`   - ファイル数: ${files.length}`);
      console.log(
        `   - サイズ: ${Math.round(
          fileSize / 1000
        )}KB (${fileSize.toLocaleString()}文字)`
      );
    }
  });

  // サマリーファイルの生成
  if (CONFIG.GENERATE_SUMMARY) {
    const summaryContent = generateSummary(categorizedFiles, timestamp);
    const summaryPath = path.join(OUTPUT_DIR, "source_files_summary.txt");
    fs.writeFileSync(summaryPath, summaryContent, "utf8");
    console.log(
      "\n📊 source_files_summary.txt (サマリーファイル) も作成しました"
    );
  }

  // 完了メッセージ
  console.log("\n" + "=".repeat(60));
  console.log("✨ すべてのファイル生成が完了しました！");
  console.log(`📂 出力先: ${OUTPUT_DIR}/`);
  console.log(`📝 生成ファイル数: ${fileCount}個 + サマリー`);
  console.log(`💾 合計サイズ: ${Math.round(totalSize / 1000)}KB`);
  console.log("=".repeat(60));
}

// サマリーファイルの内容を生成
function generateSummary(categorizedFiles, timestamp) {
  let content = `# Source Files Summary\n`;
  content += `Generated at: ${timestamp}\n\n`;
  content += `## File Distribution\n\n`;

  Object.entries(categorizedFiles).forEach(([category, files]) => {
    const config = FILE_CATEGORIES[category];
    content += `### ${config.name} (${category}.txt)\n`;
    content += `- Description: ${config.description}\n`;
    content += `- File count: ${files.length}\n`;
    content += `- Files:\n`;
    files.forEach((file) => {
      content += `  - ${file.replace(/\\/g, "/")}\n`;
    });
    content += "\n";
  });

  return content;
}

// スクリプト実行
main();
