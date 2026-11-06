import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.output', '.nitro'].includes(file)) {
        results = results.concat(walk(full));
      }
    } else if (/\.(tsx?|jsx?|mjs|json|sql|html)$/.test(file)) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('.');
let found = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /\.from\s*\(\s*["'](menu|menus)["']\s*\)/g;
  const matches = [...content.matchAll(regex)];
  if (matches.length > 0) {
    console.log(`Found invalid table query in ${file}:`, matches.map(m => m[0]));
    found += matches.length;
  }
}
console.log('Query audit done. Found invalid table queries (.from("menu") or .from("menus")):', found);
