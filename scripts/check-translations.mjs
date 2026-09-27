import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";
const translations = JSON.parse(fs.readFileSync("apps/web/src/i18n/hi.json", "utf8"));
const missing = new Set();
for (const name of fs
  .readdirSync("apps/web/src", { recursive: true })
  .filter((name) => name.endsWith(".tsx"))) {
  const file = ts.createSourceFile(
    name,
    fs.readFileSync(`apps/web/src/${name}`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      !translations[node.arguments[0].text]
    )
      missing.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(file);
}
const states = JSON.parse(fs.readFileSync("apps/web/src/features/map/india-states.json", "utf8"));
assert.equal(states.length, 36);
assert.equal(new Set(states.map((state) => state.name)).size, 36);
for (const state of states) {
  if (!translations[state.name]) missing.add(state.name);
  assert.match(state.path, /^M/);
  assert(!state.path.includes("NaN"));
}
assert.deepEqual([...missing], [], "Missing Hindi translations");
console.log(`Translation keys and all ${states.length} map region labels verified.`);
