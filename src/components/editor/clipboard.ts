import type { Slice } from "@tiptap/pm/model";

function getSingleLinkHref(slice: Slice): string | null {
  const hrefs = new Set<string>();
  let hasLinkedText = false;
  let hasUnlinkedText = false;

  slice.content.descendants((node) => {
    if (!node.isText || !node.text) {
      return;
    }

    const linkMark = node.marks.find(
      (mark) => mark.type.name === "link" && typeof mark.attrs.href === "string"
    );

    if (linkMark) {
      hasLinkedText = true;
      hrefs.add(linkMark.attrs.href);
    } else if (node.text.trim().length > 0) {
      hasUnlinkedText = true;
    }
  });

  return hasLinkedText && !hasUnlinkedText && hrefs.size === 1
    ? [...hrefs][0]
    : null;
}

export function serializeClipboardText(slice: Slice): string {
  const singleLinkHref = getSingleLinkHref(slice);

  if (singleLinkHref) {
    return singleLinkHref;
  }

  let text = "";
  slice.content.descendants((node) => {
    if (node.isText) {
      text += node.text;
    } else if (node.isBlock && text.length > 0) {
      text += "\n";
    }
  });

  return text.trim();
}
