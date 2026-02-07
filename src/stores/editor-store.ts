import { create } from "zustand";

interface EditorState {
  isEditable: boolean;
  isDirty: boolean;
  isSaving: boolean;
  content: string;
  filePath: string;
  fileSha: string | null;
  showTrackChanges: boolean;
  setEditable: (editable: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setContent: (content: string) => void;
  setFilePath: (path: string) => void;
  setFileSha: (sha: string | null) => void;
  setShowTrackChanges: (show: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isEditable: false,
  isDirty: false,
  isSaving: false,
  content: "",
  filePath: "",
  fileSha: null,
  showTrackChanges: false,
  setEditable: (editable) => set({ isEditable: editable }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSaving: (saving) => set({ isSaving: saving }),
  setContent: (content) => set({ content }),
  setFilePath: (path) => set({ filePath: path }),
  setFileSha: (sha) => set({ fileSha: sha }),
  setShowTrackChanges: (show) => set({ showTrackChanges: show }),
}));
