const fs = require("fs");
const path = require("path");

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

// メイン処理
const output = {
  created_at: new Date().toISOString(),
  files: {},
};

const files = getAllFiles("./src");
files.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  // Base64エンコード
  output.files[file] = Buffer.from(content).toString("base64");
});

// JSON形式で保存
fs.writeFileSync(
  "complete_source.json",
  JSON.stringify(output, null, 2),
  "utf8"
);
console.log("complete_source.json を作成しました（Base64エンコード済み）");
