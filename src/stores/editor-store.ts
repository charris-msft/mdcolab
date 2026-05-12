import { create } from "zustand";
import type { Editor } from "@tiptap/core";

interface EditorState {
  editor: Editor | null;
  isEditable: boolean;
  isDirty: boolean;
  isSaving: boolean;
  content: string;
  selectedText: string;
  filePath: string;
  fileSha: string | null;
  showTrackChanges: boolean;
  hybridSave: (() => void) | null;
  setEditor: (editor: Editor | null) => void;
  setEditable: (editable: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setContent: (content: string) => void;
  setSelectedText: (text: string) => void;
  setFilePath: (path: string) => void;
  setFileSha: (sha: string | null) => void;
  setShowTrackChanges: (show: boolean) => void;
  setHybridSave: (fn: (() => void) | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  isEditable: false,
  isDirty: false,
  isSaving: false,
  content: "",
  selectedText: "",
  filePath: "",
  fileSha: null,
  showTrackChanges: false,
  hybridSave: null,
  setEditor: (editor) => set({ editor }),
  setEditable: (editable) => set({ isEditable: editable }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSaving: (saving) => set({ isSaving: saving }),
  setContent: (content) => set({ content }),
  setSelectedText: (text) => set({ selectedText: text }),
  setFilePath: (path) => set({ filePath: path }),
  setFileSha: (sha) => set({ fileSha: sha }),
  setShowTrackChanges: (show) => set({ showTrackChanges: show }),
  setHybridSave: (fn) => set({ hybridSave: fn }),
}));
