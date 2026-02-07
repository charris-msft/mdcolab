import { describe, it, expect, beforeEach } from 'vitest';
import { useCommentStore } from '../comment-store';
import type { CommentThread, Comment } from '@/types';

describe('comment-store', () => {
  beforeEach(() => {
    useCommentStore.setState({
      threads: [],
      activeThreadId: null,
      filterStatus: 'open',
      searchQuery: '',
      authorFilter: [],
      isSidebarOpen: true,
      orphanedThreadIds: [],
    });
  });

  const mockThread: CommentThread = {
    id: '1',
    status: 'open',
    anchor: { type: 'text-range', selectedText: 'hello', context: { before: '', after: '' } },
    comments: [
      { id: 'c1', author: { login: 'user1', avatarUrl: '' }, body: 'Test comment', mentions: [], suggestedEdit: null, createdAt: '2026-01-01', updatedAt: null },
    ],
  };

  it('setThreads replaces all threads', () => {
    useCommentStore.getState().setThreads([mockThread]);
    expect(useCommentStore.getState().threads).toHaveLength(1);
    expect(useCommentStore.getState().threads[0].id).toBe('1');
  });

  it('addThread appends a new thread', () => {
    useCommentStore.getState().setThreads([mockThread]);
    const newThread: CommentThread = { ...mockThread, id: '2' };
    useCommentStore.getState().addThread(newThread);
    expect(useCommentStore.getState().threads).toHaveLength(2);
  });

  it('setActiveThread sets activeThreadId', () => {
    useCommentStore.getState().setActiveThread('42');
    expect(useCommentStore.getState().activeThreadId).toBe('42');
  });

  it('setActiveThread clears with null', () => {
    useCommentStore.getState().setActiveThread('42');
    useCommentStore.getState().setActiveThread(null);
    expect(useCommentStore.getState().activeThreadId).toBeNull();
  });

  it('setFilterStatus updates filter', () => {
    useCommentStore.getState().setFilterStatus('resolved');
    expect(useCommentStore.getState().filterStatus).toBe('resolved');
  });

  it('setSidebarOpen toggles sidebar', () => {
    useCommentStore.getState().setSidebarOpen(false);
    expect(useCommentStore.getState().isSidebarOpen).toBe(false);
    useCommentStore.getState().setSidebarOpen(true);
    expect(useCommentStore.getState().isSidebarOpen).toBe(true);
  });

  it('removeThread removes by id', () => {
    useCommentStore.getState().setThreads([mockThread]);
    useCommentStore.getState().removeThread('1');
    expect(useCommentStore.getState().threads).toHaveLength(0);
  });

  it('removeThread does nothing for nonexistent id', () => {
    useCommentStore.getState().setThreads([mockThread]);
    useCommentStore.getState().removeThread('nonexistent');
    expect(useCommentStore.getState().threads).toHaveLength(1);
  });

  it('addReply adds a reply to existing thread', () => {
    useCommentStore.getState().setThreads([mockThread]);
    const reply: Comment = { id: 'c2', author: { login: 'user2', avatarUrl: '' }, body: 'Reply', mentions: [], suggestedEdit: null, createdAt: '2026-01-02', updatedAt: null };
    useCommentStore.getState().addReply('1', reply);
    expect(useCommentStore.getState().threads[0].comments).toHaveLength(2);
    expect(useCommentStore.getState().threads[0].comments[1].body).toBe('Reply');
  });

  it('updateThread updates fields', () => {
    useCommentStore.getState().setThreads([mockThread]);
    useCommentStore.getState().updateThread('1', { status: 'resolved' });
    expect(useCommentStore.getState().threads[0].status).toBe('resolved');
  });

  it('updateThread does not affect other threads', () => {
    const thread2: CommentThread = { ...mockThread, id: '2' };
    useCommentStore.getState().setThreads([mockThread, thread2]);
    useCommentStore.getState().updateThread('1', { status: 'resolved' });
    expect(useCommentStore.getState().threads[1].status).toBe('open');
  });

  it('setSearchQuery updates search', () => {
    useCommentStore.getState().setSearchQuery('test');
    expect(useCommentStore.getState().searchQuery).toBe('test');
  });

  it('setAuthorFilter updates author filter', () => {
    useCommentStore.getState().setAuthorFilter(['user1', 'user2']);
    expect(useCommentStore.getState().authorFilter).toEqual(['user1', 'user2']);
  });

  it('setOrphanedThreadIds sets orphaned ids', () => {
    useCommentStore.getState().setOrphanedThreadIds(['1', '2']);
    expect(useCommentStore.getState().orphanedThreadIds).toEqual(['1', '2']);
  });
});
