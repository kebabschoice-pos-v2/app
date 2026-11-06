import ts from "typescript";
import fs from "fs";
import path from "path";

function getAllTsxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== ".output") {
        results = results.concat(getAllTsxFiles(fullPath));
      }
    } else if (file.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllTsxFiles(path.join(process.cwd(), "src"));
console.log(`Auditing dynamic evaluations in ${files.length} TSX files...`);

let issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const relFile = path.relative(process.cwd(), file);

  // Check occurrences of Math.random, Date.now, crypto.randomUUID, new Date(), localStorage.getItem, window.
  // We want to know if they occur inside component bodies or initial useState calls
  const lines = content.split("\n");
  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    // Skip comments
    const trimmed = lineText.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    if (lineText.includes("Math.random()")) {
      issues.push({ type: "MATH_RANDOM", file: relFile, line: lineNum, text: trimmed });
    }
    if (lineText.includes("crypto.randomUUID()")) {
      issues.push({ type: "CRYPTO_UUID", file: relFile, line: lineNum, text: trimmed });
    }
    if (lineText.includes("Date.now()")) {
      issues.push({ type: "DATE_NOW", file: relFile, line: lineNum, text: trimmed });
    }
    if (lineText.includes("new Date()") && (lineText.includes("useState") || lineText.includes("useMemo") || !lineText.includes("function") && !lineText.includes("onClick") && !lineText.includes("useEffect"))) {
      issues.push({ type: "NEW_DATE", file: relFile, line: lineNum, text: trimmed });
    }
    if (lineText.includes("localStorage.getItem") && (lineText.includes("useState") || lineText.includes("const ") || lineText.includes("let "))) {
      issues.push({ type: "LOCALSTORAGE_RENDER", file: relFile, line: lineNum, text: trimmed });
    }
    if (lineText.includes("window.") && (lineText.includes("useState") || lineText.includes("const ") || lineText.includes("let ")) && !lineText.includes("useEffect") && !lineText.includes("addEventListener") && !lineText.includes("removeEventListener") && !lineText.includes("onClick") && !lineText.includes("function")) {
      issues.push({ type: "WINDOW_RENDER", file: relFile, line: lineNum, text: trimmed });
    }
  });
}

console.log(`\nFound ${issues.length} potential SSR/Hydration dynamic evaluation issues:`);
issues.forEach(iss => {
  console.log(`[${iss.type}] ${iss.file}:${iss.line} -> ${iss.text}`);
});
