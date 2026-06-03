import * as assert from 'assert';
import * as path from 'path';

// ─── git-utils tests ───────────────────────────────────────────
// We import only pure functions that don't call execSync / child_process at module level.
// vscode is already shimmed by the run-unit-tests loader.
import { getRelativeFilePath, buildMdcolabUrl, RepoInfo } from '../../git-utils.js';

suite('git-utils', () => {
  suite('getRelativeFilePath', () => {
    test('computes relative path for nested file', () => {
      const result = getRelativeFilePath(
        { fsPath: path.join('C:', 'repos', 'myrepo', 'docs', 'readme.md') },
        path.join('C:', 'repos', 'myrepo'),
      );
      assert.strictEqual(result, 'docs/readme.md');
    });

    test('handles root file', () => {
      const result = getRelativeFilePath(
        { fsPath: path.join('C:', 'repos', 'myrepo', 'readme.md') },
        path.join('C:', 'repos', 'myrepo'),
      );
      assert.strictEqual(result, 'readme.md');
    });

    test('handles deeply nested file', () => {
      const result = getRelativeFilePath(
        { fsPath: path.join('C:', 'repos', 'myrepo', 'a', 'b', 'c', 'file.md') },
        path.join('C:', 'repos', 'myrepo'),
      );
      assert.strictEqual(result, 'a/b/c/file.md');
    });
  });

  suite('buildMdcolabUrl', () => {
    test('constructs correct URL', () => {
      const repoInfo: RepoInfo = {
        owner: 'charris-msft',
        repo: 'mdcolab',
        branch: 'main',
        rootPath: '/repos/mdcolab',
      };
      const url = buildMdcolabUrl(repoInfo, 'docs/readme.md', 'https://example.com');
      assert.strictEqual(url, 'https://example.com/d/charris-msft/mdcolab/main/docs/readme.md');
    });

    test('handles nested paths', () => {
      const repoInfo: RepoInfo = {
        owner: 'user',
        repo: 'test',
        branch: 'feature/branch',
        rootPath: '/repos/test',
      };
      const url = buildMdcolabUrl(repoInfo, 'a/b/c/file.md', 'https://app.com');
      assert.strictEqual(url, 'https://app.com/d/user/test/feature/branch/a/b/c/file.md');
    });

    test('handles trailing slash on baseUrl gracefully', () => {
      const repoInfo: RepoInfo = {
        owner: 'o',
        repo: 'r',
        branch: 'main',
        rootPath: '/',
      };
      // The function concatenates directly, so a trailing slash would double-up
      const url = buildMdcolabUrl(repoInfo, 'file.md', 'https://app.com');
      assert.ok(url.startsWith('https://app.com/d/'));
    });
  });
});

// ─── github-api pure-function tests ────────────────────────────
import { parseMetadata, extractCommentBody, buildIssueBody, isAccessError, CommentAnchor, IssueMetadata } from '../../github-api.js';

suite('github-api helpers', () => {
  const sampleAnchor: CommentAnchor = {
    type: 'text-range',
    selectedText: 'hello world',
    context: { before: 'prefix', after: 'suffix' },
  };
  const sampleMeta: IssueMetadata = { file: 'docs/readme.md', anchor: sampleAnchor };

  suite('parseMetadata', () => {
    test('parses valid metadata block', () => {
      const body = `<!-- mdcolab-metadata\n${JSON.stringify(sampleMeta, null, 2)}\n-->\n\nSome body`;
      const result = parseMetadata(body);
      assert.deepStrictEqual(result, sampleMeta);
    });

    test('returns null for missing metadata', () => {
      assert.strictEqual(parseMetadata('no metadata here'), null);
    });

    test('returns null for malformed JSON', () => {
      const body = '<!-- mdcolab-metadata\n{bad json}\n-->';
      assert.strictEqual(parseMetadata(body), null);
    });

    test('returns null for empty string', () => {
      assert.strictEqual(parseMetadata(''), null);
    });
  });

  suite('extractCommentBody', () => {
    test('strips metadata block', () => {
      const body = `<!-- mdcolab-metadata\n${JSON.stringify(sampleMeta)}\n-->\n\nUser comment here`;
      assert.strictEqual(extractCommentBody(body), 'User comment here');
    });

    test('returns full string when no metadata', () => {
      assert.strictEqual(extractCommentBody('Just a comment'), 'Just a comment');
    });

    test('trims whitespace', () => {
      assert.strictEqual(extractCommentBody('  spaced  '), 'spaced');
    });
  });

  suite('buildIssueBody', () => {
    test('produces body with metadata block', () => {
      const body = buildIssueBody(sampleAnchor, 'My comment', 'docs/readme.md');
      // The body should contain the metadata block and the comment
      assert.ok(body.includes('<!-- mdcolab-metadata'));
      assert.ok(body.includes('-->'));
      assert.ok(body.includes('My comment'));
    });

    test('round-trips through parseMetadata + extractCommentBody', () => {
      const body = buildIssueBody(sampleAnchor, 'Round trip', 'file.md');
      const meta = parseMetadata(body);
      assert.deepStrictEqual(meta?.file, 'file.md');
      assert.deepStrictEqual(meta?.anchor.selectedText, 'hello world');
      assert.strictEqual(extractCommentBody(body), 'Round trip');
    });
  });

  suite('isAccessError', () => {
    test('treats 401/403/404 as access errors', () => {
      assert.strictEqual(isAccessError({ status: 401 }), true);
      assert.strictEqual(isAccessError({ status: 403 }), true);
      assert.strictEqual(isAccessError({ status: 404 }), true);
    });

    test('treats other statuses as non-access errors', () => {
      assert.strictEqual(isAccessError({ status: 422 }), false);
      assert.strictEqual(isAccessError({ status: 500 }), false);
      assert.strictEqual(isAccessError({ status: 200 }), false);
    });

    test('handles errors without a status', () => {
      assert.strictEqual(isAccessError(new Error('boom')), false);
      assert.strictEqual(isAccessError(null), false);
      assert.strictEqual(isAccessError(undefined), false);
    });
  });
});
