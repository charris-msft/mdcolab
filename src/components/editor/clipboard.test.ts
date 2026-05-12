import { describe, expect, it } from "vitest";
import { Fragment, Schema, Slice } from "@tiptap/pm/model";
import { serializeClipboardText } from "./clipboard";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
  },
  marks: {
    link: {
      attrs: { href: {} },
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs: (dom) => ({
            href: (dom as HTMLElement).getAttribute("href"),
          }),
        },
      ],
      toDOM: (mark) => ["a", { href: mark.attrs.href }, 0],
    },
  },
});

function sliceFromParagraph(...content: Parameters<typeof schema.nodes.paragraph.create>[1][]) {
  return new Slice(
    Fragment.from(schema.nodes.paragraph.create(null, content)),
    0,
    0
  );
}

describe("serializeClipboardText", () => {
  it("copies a selected single link as its raw URL", () => {
    const url =
      "https://ca-web-ai-preview.calmflower-64b2252f.eastus2.azurecontainerapps.io/d/charris-msft/PMStudio/main/fc2/Forge-Chat-v2-Auth-Plan.md";
    const link = schema.marks.link.create({ href: url });
    const slice = sliceFromParagraph(
      schema.text("Forge-Chat-v2-Auth-Plan.md", [link])
    );

    expect(serializeClipboardText(slice)).toBe(url);
  });

  it("copies normal selections as plain text", () => {
    const slice = sliceFromParagraph(schema.text("Plain document title"));

    expect(serializeClipboardText(slice)).toBe("Plain document title");
  });

  it("keeps visible text for mixed link and non-link selections", () => {
    const link = schema.marks.link.create({ href: "https://example.com/doc" });
    const slice = sliceFromParagraph(
      schema.text("See "),
      schema.text("the doc", [link]),
      schema.text(" for details")
    );

    expect(serializeClipboardText(slice)).toBe("See the doc for details");
  });
});
