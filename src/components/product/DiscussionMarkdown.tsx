import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  img: ({ alt }) => <span>{alt ? `[Image: ${alt}]` : "[Image omitted]"}</span>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
  table: ({ children }) => (
    <div
      className="discussion-table"
      tabIndex={0}
      role="region"
      aria-label="Table"
    >
      <table>{children}</table>
    </div>
  ),
};

const DiscussionMarkdown = ({ content }: { content: string }) => (
  <div className="discussion-markdown">
    <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {content}
    </Markdown>
  </div>
);

export default memo(DiscussionMarkdown);
