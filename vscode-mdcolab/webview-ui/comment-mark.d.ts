import { Mark } from "@tiptap/core";
export interface CommentMarkOptions {
    HTMLAttributes: Record<string, unknown>;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        commentMark: {
            setCommentMark: (threadId: string) => ReturnType;
            unsetCommentMark: (threadId: string) => ReturnType;
        };
    }
}
export declare const CommentMark: Mark<CommentMarkOptions, any>;
