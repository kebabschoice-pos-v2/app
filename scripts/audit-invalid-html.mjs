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
console.log(`Auditing ${files.length} .tsx files for invalid HTML and hydration hazards...`);

let issuesFound = 0;

for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const relPath = path.relative(process.cwd(), f);

  // 1. Nested form
  if (/<form[\s\S]*?<form/i.test(content)) {
    // Check if real nested form (simple heuristic)
    const matches = content.match(/<form[\s>]/g);
    if (matches && matches.length > 1) {
      // Look closer
      let formDepth = 0;
      const lines = content.split("\n");
      lines.forEach((l, idx) => {
        if (/<form[\s>]/.test(l)) {
          formDepth++;
          if (formDepth > 1) {
            console.log(`[NESTED FORM] ${relPath}:${idx + 1} - nested <form> detected`);
            issuesFound++;
          }
        }
        if (/<\/form>/.test(l)) {
          formDepth = Math.max(0, formDepth - 1);
        }
      });
    }
  }

  // 2. Nested button / Button in Button
  // Check lines where <button or <Button appears inside another button
  {
    const lines = content.split("\n");
    let buttonDepth = 0;
    lines.forEach((l, idx) => {
      const openBtn = (l.match(/<(button|Button)[\s>]/g) || []).length;
      const closeBtn = (l.match(/<\/(button|Button)>/g) || []).length;
      if (openBtn > 0 && buttonDepth > 0) {
        console.log(`[NESTED BUTTON] ${relPath}:${idx + 1} - nested <button> or <Button> detected`);
        issuesFound++;
      }
      buttonDepth += openBtn - closeBtn;
      if (buttonDepth < 0) buttonDepth = 0;
    });
  }

  // 3. Div inside P / block inside P
  {
    // Search for <p ...> that contains <div or <ul> or <table> before </p>
    const lines = content.split("\n");
    let inP = false;
    let pStartLine = 0;
    lines.forEach((l, idx) => {
      if (/<p[\s>]/.test(l)) {
        inP = true;
        pStartLine = idx + 1;
      }
      if (inP && (/<div[\s>]/.test(l) || /<ul[\s>]/.test(l) || /<table[\s>]/.test(l))) {
        console.log(`[BLOCK IN P] ${relPath}:${idx + 1} - block element (<div/ul/table>) inside <p> starting at line ${pStartLine}`);
        issuesFound++;
      }
      if (/<\/p>/.test(l)) {
        inP = false;
      }
    });
  }

  // 4. Nested a or Link
  {
    const lines = content.split("\n");
    let aDepth = 0;
    lines.forEach((l, idx) => {
      const openA = (l.match(/<(a|Link)[\s>]/g) || []).length;
      const closeA = (l.match(/<\/(a|Link)>/g) || []).length;
      if (openA > 0 && aDepth > 0) {
        console.log(`[NESTED LINK] ${relPath}:${idx + 1} - nested <a> or <Link> detected`);
        issuesFound++;
      }
      aDepth += openA - closeA;
      if (aDepth < 0) aDepth = 0;
    });
  }
}

console.log(`Total invalid HTML issues detected: ${issuesFound}`);
