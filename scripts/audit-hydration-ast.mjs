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
console.log(`Starting advanced TS AST analysis on ${files.length} TSX files...`);

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

  function getTagName(node) {
    if (ts.isJsxElement(node)) {
      return node.openingElement.tagName.getText(sourceFile);
    }
    if (ts.isJsxSelfClosingElement(node)) {
      return node.tagName.getText(sourceFile);
    }
    return null;
  }

  function visitJsx(node, ancestorTags = []) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getTagName(node);
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const lowerTag = (tagName || "").toLowerCase();

      // Check 1: Button in Button
      const isBtn = lowerTag === "button";
      const hasBtnAncestor = ancestorTags.some(t => t.toLowerCase() === "button");
      if (isBtn && hasBtnAncestor) {
        issues.push({
          type: "BUTTON_IN_BUTTON",
          file: relFile,
          line,
          msg: `<${tagName}> nested inside button ancestor (${ancestorTags.join(" > ")})`
        });
      }

      // Check 2: Link / a in a
      const isLink = lowerTag === "a" || tagName === "Link";
      const hasLinkAncestor = ancestorTags.some(t => t.toLowerCase() === "a" || t === "Link");
      if (isLink && hasLinkAncestor) {
        issues.push({
          type: "LINK_IN_LINK",
          file: relFile,
          line,
          msg: `<${tagName}> nested inside link ancestor (${ancestorTags.join(" > ")})`
        });
      }

      // Check 3: Block in p
      const isBlock = ["div", "p", "ul", "ol", "li", "table", "form", "section", "article"].includes(lowerTag);
      const hasPAncestor = ancestorTags.some(t => t.toLowerCase() === "p");
      if (isBlock && hasPAncestor) {
        issues.push({
          type: "BLOCK_IN_P",
          file: relFile,
          line,
          msg: `<${tagName}> nested inside <p> (${ancestorTags.join(" > ")})`
        });
      }

      if (ts.isJsxElement(node)) {
        const nextAncestors = [...ancestorTags, tagName];
        node.children.forEach(child => visitJsx(child, nextAncestors));
        return;
      }
    }

    ts.forEachChild(node, child => visitJsx(child, ancestorTags));
  }

  visitJsx(sourceFile);
}

console.log(`\nFound ${issues.length} HTML structure issues:`);
issues.forEach(iss => {
  console.log(`[${iss.type}] ${iss.file}:${iss.line} -> ${iss.msg}`);
});
