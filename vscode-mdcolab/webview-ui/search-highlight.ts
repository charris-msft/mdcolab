import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";

export interface SearchHighlightOptions {
  resultClass: string;
  activeClass: string;
}

interface Match {
  from: number;
  to: number;
}

interface SearchState {
  term: string;
  matches: Match[];
  active: number;
  decorations: DecorationSet;
}

export const searchHighlightKey = new PluginKey<SearchState>("searchHighlight");

const EMPTY_STATE: SearchState = {
  term: "",
  matches: [],
  active: 0,
  decorations: DecorationSet.empty,
};

function computeMatches(doc: ProseMirrorNode, term: string): Match[] {
  const matches: Match[] = [];
  const query = term.toLowerCase();
  if (!query) return matches;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let idx = text.indexOf(query);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + term.length });
      idx = text.indexOf(query, idx + term.length);
    }
  });
  return matches;
}

function buildDecorations(
  doc: ProseMirrorNode,
  matches: Match[],
  active: number,
  options: SearchHighlightOptions,
): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  const decorations = matches.map((match, i) =>
    Decoration.inline(match.from, match.to, {
      class:
        i === active
          ? `${options.resultClass} ${options.activeClass}`
          : options.resultClass,
    }),
  );
  return DecorationSet.create(doc, decorations);
}

type SearchMeta =
  | { type: "setTerm"; term: string }
  | { type: "setActive"; index: number }
  | { type: "clear" };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchTerm: (term: string) => ReturnType;
      setActiveSearchResult: (index: number) => ReturnType;
      nextSearchResult: () => ReturnType;
      prevSearchResult: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchHighlight = Extension.create<SearchHighlightOptions>({
  name: "searchHighlight",

  addOptions() {
    return {
      resultClass: "find-highlight",
      activeClass: "find-active",
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<SearchState>({
        key: searchHighlightKey,
        state: {
          init: () => EMPTY_STATE,
          apply(tr, value, _oldState, newState) {
            const meta = tr.getMeta(searchHighlightKey) as SearchMeta | undefined;
            if (meta) {
              if (meta.type === "clear") return EMPTY_STATE;
              if (meta.type === "setTerm") {
                if (!meta.term.trim()) return EMPTY_STATE;
                const matches = computeMatches(newState.doc, meta.term);
                return {
                  term: meta.term,
                  matches,
                  active: 0,
                  decorations: buildDecorations(newState.doc, matches, 0, options),
                };
              }
              if (meta.type === "setActive" && value.matches.length > 0) {
                const len = value.matches.length;
                const active = ((meta.index % len) + len) % len;
                return {
                  ...value,
                  active,
                  decorations: buildDecorations(newState.doc, value.matches, active, options),
                };
              }
            }
            if (tr.docChanged && value.term) {
              const matches = computeMatches(newState.doc, value.term);
              const active = matches.length === 0 ? 0 : Math.min(value.active, matches.length - 1);
              return {
                term: value.term,
                matches,
                active,
                decorations: buildDecorations(newState.doc, matches, active, options),
              };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            return searchHighlightKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(searchHighlightKey, { type: "setTerm", term }));
          }
          return true;
        },
      setActiveSearchResult:
        (index: number) =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(searchHighlightKey, { type: "setActive", index }));
          }
          return true;
        },
      nextSearchResult:
        () =>
        ({ state, dispatch }) => {
          const current = searchHighlightKey.getState(state);
          if (!current || current.matches.length === 0) return false;
          if (dispatch) {
            dispatch(
              state.tr.setMeta(searchHighlightKey, {
                type: "setActive",
                index: current.active + 1,
              }),
            );
          }
          return true;
        },
      prevSearchResult:
        () =>
        ({ state, dispatch }) => {
          const current = searchHighlightKey.getState(state);
          if (!current || current.matches.length === 0) return false;
          if (dispatch) {
            dispatch(
              state.tr.setMeta(searchHighlightKey, {
                type: "setActive",
                index: current.active - 1,
              }),
            );
          }
          return true;
        },
      clearSearch:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(searchHighlightKey, { type: "clear" }));
          }
          return true;
        },
    };
  },
});

export function getSearchResults(editor: Editor): { count: number; active: number } {
  const state = searchHighlightKey.getState(editor.state);
  const count = state?.matches.length ?? 0;
  return { count, active: count > 0 ? (state?.active ?? 0) : -1 };
}
