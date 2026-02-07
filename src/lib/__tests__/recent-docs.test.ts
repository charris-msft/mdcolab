import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentDocs, addRecentDoc } from '../recent-docs';

describe('recent-docs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getRecentDocs', () => {
    it('returns empty array when no docs stored', () => {
      expect(getRecentDocs()).toEqual([]);
    });

    it('returns stored docs', () => {
      const docs = [{ owner: 'user', repo: 'test', branch: 'main', path: 'README.md', fileName: 'README.md', accessedAt: '2026-01-01T00:00:00.000Z' }];
      localStorage.setItem('mdcolab:recent-docs', JSON.stringify(docs));
      expect(getRecentDocs()).toEqual(docs);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem('mdcolab:recent-docs', 'not-json');
      expect(getRecentDocs()).toEqual([]);
    });
  });

  describe('addRecentDoc', () => {
    it('adds a document', () => {
      addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: 'file.md', fileName: 'file.md' });
      const docs = getRecentDocs();
      expect(docs).toHaveLength(1);
      expect(docs[0].owner).toBe('user');
      expect(docs[0].accessedAt).toBeDefined();
    });

    it('moves existing doc to front on re-access', () => {
      addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: 'first.md', fileName: 'first.md' });
      addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: 'second.md', fileName: 'second.md' });
      addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: 'first.md', fileName: 'first.md' });
      const docs = getRecentDocs();
      expect(docs).toHaveLength(2);
      expect(docs[0].path).toBe('first.md');
    });

    it('caps at 10 documents', () => {
      for (let i = 0; i < 15; i++) {
        addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: `file${i}.md`, fileName: `file${i}.md` });
      }
      expect(getRecentDocs()).toHaveLength(10);
    });

    it('deduplicates by owner+repo+branch+path', () => {
      addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: 'same.md', fileName: 'same.md' });
      addRecentDoc({ owner: 'user', repo: 'test', branch: 'main', path: 'same.md', fileName: 'same.md' });
      expect(getRecentDocs()).toHaveLength(1);
    });
  });
});
