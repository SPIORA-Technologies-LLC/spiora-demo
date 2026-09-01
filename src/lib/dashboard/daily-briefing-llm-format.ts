export type LlmSummaryBlock =
  | { kind: "subheading"; text: string }
  | { kind: "paragraph"; text: string };

export function splitLlmSummaryParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanSubheadingText(text: string): string {
  return text.replace(/:+\s*$/, "").trim();
}

function stripInlineMarkdownBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

/** Turn LLM markdown section titles (`**Title**`) into styled subheading blocks. */
export function parseLlmSummaryBlocks(text: string): LlmSummaryBlock[] {
  const blocks: LlmSummaryBlock[] = [];

  for (const paragraph of splitLlmSummaryParagraphs(text)) {
    const subheadingOnly = /^\*\*(.+?)\*\*:?\s*$/.exec(paragraph);
    if (subheadingOnly) {
      blocks.push({ kind: "subheading", text: cleanSubheadingText(subheadingOnly[1]) });
      continue;
    }

    const subheadingWithBody = /^\*\*(.+?)\*\*:?\s+([\s\S]+)$/.exec(paragraph);
    if (subheadingWithBody) {
      blocks.push({ kind: "subheading", text: cleanSubheadingText(subheadingWithBody[1]) });
      blocks.push({
        kind: "paragraph",
        text: stripInlineMarkdownBold(subheadingWithBody[2]),
      });
      continue;
    }

    blocks.push({
      kind: "paragraph",
      text: stripInlineMarkdownBold(paragraph),
    });
  }

  return blocks;
}
