/**
 * Standalone unit-test runner that does NOT require VS Code.
 *
 * It registers a minimal `vscode` shim in the module cache so that
 * source modules which `import * as vscode from 'vscode'` can load
 * without error.  Only pure-logic functions are exercised here —
 * anything that calls real VS Code APIs should use the integration
 * test runner (`@vscode/test-electron`) instead.
 */

import * as path from 'path';
import Module from 'module';
import Mocha from 'mocha';
import { glob } from 'glob';

// ── vscode shim ────────────────────────────────────────────────
// Provide just enough surface so that `import * as vscode from 'vscode'`
// at the top of git-utils.ts / github-api.ts / comment-decorations.ts
// does not throw.

const vscodeMock: Record<string, any> = {
  Uri: { file: (p: string) => ({ fsPath: p }) },
  window: {
    createTextEditorDecorationType: () => ({}),
    showInputBox: async () => undefined,
    showInformationMessage: async () => undefined,
  },
  OverviewRulerLane: { Right: 2 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  TreeItem: class {
    label: string;
    collapsibleState: number;
    constructor(label: string, state = 0) {
      this.label = label;
      this.collapsibleState = state;
    }
  },
  ThemeIcon: class {
    constructor(public id: string, public color?: any) {}
  },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  MarkdownString: class {
    value = '';
    isTrusted = false;
    appendMarkdown(v: string) { this.value += v; }
  },
  EventEmitter: class {
    event = () => {};
    fire() {}
    dispose() {}
  },
  Range: class {
    constructor(
      public start: any,
      public end: any,
    ) {}
  },
  Position: class {
    constructor(
      public line: number,
      public character: number,
    ) {}
  },
  authentication: {
    getSession: async () => null,
  },
  workspace: {
    getConfiguration: () => ({
      get: () => undefined,
    }),
  },
  commands: {
    registerCommand: () => ({ dispose() {} }),
  },
};

// Intercept require('vscode') to return our mock
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    // Return a sentinel that we handle below
    return 'vscode';
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'vscode') {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// ── Run Mocha ──────────────────────────────────────────────────
async function main() {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });
  const testsRoot = path.resolve(__dirname, './suite');

  const files = await glob('**/*.test.js', { cwd: testsRoot });
  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  mocha.run(failures => {
    if (failures > 0) {
      console.error(`\n${failures} test(s) failed.`);
      process.exit(1);
    }
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
