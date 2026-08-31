import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

// Render chapter/preface markdown to SAFE HTML. `marked` passes raw HTML
// through untouched, so we always sanitize the result — that way a stray (or
// malicious) <script>, event handler, or javascript: URL in any chapter body
// can never run in a reader's browser. Only the tags markdown itself produces
// are allowed through.
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? "", { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: [
      "p", "br", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "em", "b", "i", "s", "del", "mark", "sup", "sub",
      "ul", "ol", "li",
      "blockquote", "code", "pre",
      "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title"],
      "*": ["id"],
    },
    // only safe URL schemes; blocks javascript:, data: (except images), etc.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    // force external links to be safe
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    },
    disallowedTagsMode: "discard",
  });
}
