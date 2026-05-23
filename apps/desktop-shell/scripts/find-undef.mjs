// One-shot static check for main.js: walks the AST with acorn and reports any
// identifier that is referenced but never declared in scope, never imported,
// and not a known browser/runtime global. Catches the kind of refactor-leftover
// where a function was moved into a module but the import statement was not
// updated.
//
// Run: node scripts/find-undef.mjs
//
// Exits non-zero when something looks undefined so it can be wired into a
// pre-commit hook later if desired.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "acorn";
import * as walk from "acorn-walk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "..", "src", "main.js");
const source = readFileSync(target, "utf8");

const ast = parse(source, {
  ecmaVersion: "latest",
  sourceType: "module",
  allowAwaitOutsideFunction: true,
  allowReturnOutsideFunction: true,
  locations: true,
});

const builtinGlobals = new Set([
  "window", "document", "console", "setTimeout", "clearTimeout", "setInterval",
  "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "localStorage",
  "sessionStorage", "navigator", "fetch", "URL", "URLSearchParams", "Math", "JSON",
  "Object", "Array", "String", "Number", "Boolean", "Date", "RegExp", "Map", "Set",
  "WeakMap", "WeakSet", "Promise", "Error", "TypeError", "ReferenceError",
  "RangeError", "Symbol", "Proxy", "Reflect", "globalThis", "undefined", "NaN",
  "Infinity", "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURIComponent",
  "decodeURIComponent", "encodeURI", "decodeURI", "Intl", "DOMParser",
  "MutationObserver", "ResizeObserver", "IntersectionObserver", "HTMLElement",
  "Element", "Node", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent",
  "ClipboardEvent", "DragEvent", "FocusEvent", "AbortController", "AbortSignal",
  "structuredClone", "queueMicrotask", "atob", "btoa", "alert", "confirm",
  "prompt", "performance", "crypto", "TextEncoder", "TextDecoder",
  "FileReader", "Blob", "File", "FormData", "Headers", "Request", "Response",
]);

const moduleScope = new Set();
const moduleFunctions = new Set();

// Collect every binding declared at module scope.
for (const node of ast.body) {
  if (node.type === "ImportDeclaration") {
    for (const spec of node.specifiers) {
      moduleScope.add(spec.local.name);
    }
  } else if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      collectPatternBindings(decl.id, moduleScope);
    }
  } else if (node.type === "FunctionDeclaration") {
    if (node.id) {
      moduleScope.add(node.id.name);
      moduleFunctions.add(node.id.name);
    }
  } else if (node.type === "ClassDeclaration") {
    if (node.id) moduleScope.add(node.id.name);
  } else if (node.type === "ExportNamedDeclaration" && node.declaration) {
    const d = node.declaration;
    if (d.type === "VariableDeclaration") {
      for (const decl of d.declarations) collectPatternBindings(decl.id, moduleScope);
    } else if (d.type === "FunctionDeclaration" && d.id) {
      moduleScope.add(d.id.name);
    } else if (d.type === "ClassDeclaration" && d.id) {
      moduleScope.add(d.id.name);
    }
  }
}

function collectPatternBindings(node, into) {
  if (!node) return;
  if (node.type === "Identifier") into.add(node.name);
  else if (node.type === "ObjectPattern") for (const p of node.properties) {
    if (p.type === "Property") collectPatternBindings(p.value, into);
    else if (p.type === "RestElement") collectPatternBindings(p.argument, into);
  } else if (node.type === "ArrayPattern") for (const el of node.elements) {
    if (el) collectPatternBindings(el, into);
  } else if (node.type === "AssignmentPattern") collectPatternBindings(node.left, into);
  else if (node.type === "RestElement") collectPatternBindings(node.argument, into);
}

// Walk every Identifier in a call/new/member position; for each, climb the
// ancestor list to verify it's not declared inside a nested scope.
const undefHits = new Map(); // name -> first occurrence loc

const ancestor = walk.ancestor;
ancestor(ast, {
  CallExpression(node, ancestors) {
    inspectCallee(node.callee, ancestors);
  },
  NewExpression(node, ancestors) {
    inspectCallee(node.callee, ancestors);
  },
});

function inspectCallee(callee, ancestors) {
  if (!callee || callee.type !== "Identifier") return;
  const name = callee.name;
  if (builtinGlobals.has(name)) return;
  if (moduleScope.has(name)) return;
  if (isDeclaredInAnyEnclosingScope(name, ancestors)) return;
  if (!undefHits.has(name)) undefHits.set(name, callee.loc?.start);
}

function isDeclaredInAnyEnclosingScope(name, ancestors) {
  // Build scope chain bottom-up; check each scoping ancestor's params/vars/etc.
  for (let i = ancestors.length - 2; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (introducesScope(node)) {
      const bindings = collectScopeBindings(node);
      if (bindings.has(name)) return true;
    }
  }
  return false;
}

function introducesScope(node) {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "BlockStatement" ||
    node.type === "ForStatement" ||
    node.type === "ForOfStatement" ||
    node.type === "ForInStatement" ||
    node.type === "CatchClause"
  );
}

function collectScopeBindings(scopeNode) {
  const bindings = new Set();
  if (scopeNode.type === "FunctionDeclaration" || scopeNode.type === "FunctionExpression" || scopeNode.type === "ArrowFunctionExpression") {
    for (const p of scopeNode.params) collectPatternBindings(p, bindings);
    if (scopeNode.id) bindings.add(scopeNode.id.name);
    if (scopeNode.body?.type === "BlockStatement") {
      collectBlockBindings(scopeNode.body, bindings);
    }
  } else if (scopeNode.type === "BlockStatement") {
    collectBlockBindings(scopeNode, bindings);
  } else if (scopeNode.type === "ForStatement" || scopeNode.type === "ForOfStatement" || scopeNode.type === "ForInStatement") {
    if (scopeNode.init?.type === "VariableDeclaration") {
      for (const d of scopeNode.init.declarations) collectPatternBindings(d.id, bindings);
    }
    if (scopeNode.left?.type === "VariableDeclaration") {
      for (const d of scopeNode.left.declarations) collectPatternBindings(d.id, bindings);
    }
  } else if (scopeNode.type === "CatchClause") {
    if (scopeNode.param) collectPatternBindings(scopeNode.param, bindings);
  }
  return bindings;
}

function collectBlockBindings(block, into) {
  for (const stmt of block.body) {
    if (stmt.type === "VariableDeclaration") {
      for (const d of stmt.declarations) collectPatternBindings(d.id, into);
    } else if (stmt.type === "FunctionDeclaration" && stmt.id) {
      into.add(stmt.id.name);
    } else if (stmt.type === "ClassDeclaration" && stmt.id) {
      into.add(stmt.id.name);
    }
  }
}

if (undefHits.size === 0) {
  console.log("OK: no undefined call references in src/main.js");
  process.exit(0);
}

console.error("Undefined call references in src/main.js:");
for (const [name, loc] of undefHits) {
  console.error(`  ${name}  (first seen at line ${loc?.line}, col ${loc?.column})`);
}
process.exit(1);
