import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";

// Explicit protocol allowlist; repository HTML and remote image embeds are omitted.
export function safeUrl(value: string): string | undefined {
  try { const url = new URL(value); return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  const safe = href ? safeUrl(href) : undefined;
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{children}</a> : <span>{children}</span>;
}
export function Markdown({ text, githubUrl }: { text: string; githubUrl?: string | null }) {
  return <div className="space-y-3 break-words [&_h1]:text-xl [&_h2]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-auto [&_pre]:bg-muted [&_pre]:p-3 [&_table]:block [&_table]:overflow-auto [&_td]:border [&_td]:p-2 [&_th]:p-2">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={(url) => {
      try { return safeUrl(githubUrl ? new URL(url, githubUrl).href : url) ?? ""; } catch { return ""; }
    }} components={{ a: ({ href, children }) => <ExternalLink href={href ?? null}>{children}</ExternalLink>, img: ({ alt }) => <span>{alt ? `[Image: ${alt}]` : "[Image omitted]"}</span> }}>{text}</ReactMarkdown>
  </div>;
}
