import fs from "fs";
import path from "path";

// Dossiers à ignorer
const ignoreDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".vscode",
  ".idea",
]);

function listFiles(startPath, level = 0) {
  if (!fs.existsSync(startPath)) return;

  const files = fs.readdirSync(startPath);

  files.forEach((file) => {
    const fullPath = path.join(startPath, file);
    const stat = fs.statSync(fullPath);

    // Ignorer certains dossiers
    if (stat.isDirectory() && ignoreDirs.has(file)) {
      return;
    }

    const indent = " ".repeat(4 * level);

    if (stat.isDirectory()) {
      console.log(`${indent}${file}/`);
      listFiles(fullPath, level + 1);
    } else {
      console.log(`${indent}    ${file}`);
    }
  });
}

// Exécution
listFiles(".");
