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

let errors = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative(process.cwd(), file);

  // Match JSX tags using a token stack
  // Strip out comments, strings, and JS expressions roughly to find JSX structure
  const tagRegex = /<\/?([a-zA-Z0-9_\-]+)(\s+[^>]*?)?(\/?)>/g;
  let match;
  const stack = [];

  // Track lines
  const lines = content.split("\n");
  function getLine(pos) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      count += lines[i].length + 1;
      if (count > pos) return i + 1;
    }
    return 1;
  }

  while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = fullTag.startsWith("</");
    const isSelfClosing = fullTag.endsWith("/>");
    const pos = match.index;
    const line = getLine(pos);

    // Skip native non-HTML uppercase components except Link and Button
    const isHtmlOrKeyComp = /^[a-z]/.test(tagName) || tagName === "Link" || tagName === "Button";
    if (!isHtmlOrKeyComp) continue;

    if (isClosing) {
      // Find matching tag in stack
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === tagName) {
          stack.splice(i, 1);
          break;
        }
      }
    } else if (!isSelfClosing) {
      // Check invalid nesting with current stack
      const lower = tagName.toLowerCase();
      const parentTags = stack.map(s => s.name.toLowerCase());

      if (lower === "button") {
        if (parentTags.includes("button")) {
          console.error(`[INVALID HTML] Nested button: ${rel}:${line}`);
          errors++;
        }
      }

      if (lower === "a" || tagName === "Link") {
        if (parentTags.includes("a") || stack.some(s => s.name === "Link")) {
          console.error(`[INVALID HTML] Nested link: ${rel}:${line}`);
          errors++;
        }
      }

      if (lower === "form") {
        if (parentTags.includes("form")) {
          console.error(`[INVALID HTML] Nested form: ${rel}:${line}`);
          errors++;
        }
      }

      if (["div", "p", "table", "ul", "ol", "form"].includes(lower)) {
        if (parentTags.includes("p")) {
          console.error(`[INVALID HTML] ${tagName} inside <p>: ${rel}:${line}`);
          errors++;
        }
      }

      stack.push({ name: tagName, line });
    }
  }
}

console.log(`HTML nesting check complete. Total errors found: ${errors}`);
