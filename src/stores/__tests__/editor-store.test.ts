import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editor-store';

describe('editor-store', () => {
  beforeEach(() => {
    useEditorStore.setState({
      isEditable: false,
      content: '',
      isDirty: false,
      isSaving: false,
      filePath: '',
      fileSha: null,
      showTrackChanges: false,
    });
  });

  it('setContent updates content', () => {
    useEditorStore.getState().setContent('# Hello');
    expect(useEditorStore.getState().content).toBe('# Hello');
  });

  it('setDirty updates dirty flag', () => {
    useEditorStore.getState().setDirty(true);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('setSaving updates saving flag', () => {
    useEditorStore.getState().setSaving(true);
    expect(useEditorStore.getState().isSaving).toBe(true);
  });

  it('setFilePath updates path', () => {
    useEditorStore.getState().setFilePath('docs/readme.md');
    expect(useEditorStore.getState().filePath).toBe('docs/readme.md');
  });

  it('setFileSha updates sha', () => {
    useEditorStore.getState().setFileSha('abc123');
    expect(useEditorStore.getState().fileSha).toBe('abc123');
  });

  it('setFileSha clears with null', () => {
    useEditorStore.getState().setFileSha('abc123');
    useEditorStore.getState().setFileSha(null);
    expect(useEditorStore.getState().fileSha).toBeNull();
  });

  it('setShowTrackChanges updates flag', () => {
    useEditorStore.getState().setShowTrackChanges(true);
    expect(useEditorStore.getState().showTrackChanges).toBe(true);
  });

  it('setEditable updates editable flag', () => {
    useEditorStore.getState().setEditable(true);
    expect(useEditorStore.getState().isEditable).toBe(true);
  });
});
