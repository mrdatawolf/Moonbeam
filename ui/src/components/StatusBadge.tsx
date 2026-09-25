// Reusable status badge (CONTRACT-003 "Shared pieces"): renders any SV value
// with its label, glyph and tone. The glyph shape carries meaning as well as
// the colour (SV-2); screen readers hear "<family>: <label>" (UX-3).
// Pattern follows Paperclip's StatusGlyph/StatusBadge (MIT); no code was
// copied, so no THIRD_PARTY_NOTICES entry is needed.
import type { Glyph, StatusDef, Tone } from "../lib/status";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-tone-neutral-fg bg-tone-neutral-bg border-tone-neutral-border",
  live: "text-tone-live-fg bg-tone-live-bg border-tone-live-border",
  attention: "text-tone-attention-fg bg-tone-attention-bg border-tone-attention-border",
  review: "text-tone-review-fg bg-tone-review-bg border-tone-review-border",
  success: "text-tone-success-fg bg-tone-success-bg border-tone-success-border",
  danger: "text-tone-danger-fg bg-tone-danger-bg border-tone-danger-border",
};

/** 16-unit glyphs drawn in currentColor. Shapes, not colours, tell statuses apart. */
export function StatusGlyph({ glyph, className = "size-3.5" }: { glyph: Glyph; className?: string }) {
  const common = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `shrink-0 ${className}`,
    "aria-hidden": true,
    focusable: false,
    "data-glyph": glyph,
  };
  switch (glyph) {
    case "circle-dashed":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" strokeDasharray="2.4 2.4" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
        </svg>
      );
    case "circle-half":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
        </svg>
      );
    case "circle-dot":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" />
        </svg>
      );
    case "circle-check":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M5.2 8.2l1.9 1.9 3.8-4" />
        </svg>
      );
    case "circle-slash":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M3.8 12.2l8.4-8.4" />
        </svg>
      );
    case "octagon":
      return (
        <svg {...common}>
          <path d="M5.5 2h5L14 5.5v5L10.5 14h-5L2 10.5v-5z" fill="currentColor" />
          <path d="M5 8h6" stroke="var(--color-tone-danger-bg)" />
        </svg>
      );
    case "octagon-outline":
      return (
        <svg {...common}>
          <path d="M5.5 2h5L14 5.5v5L10.5 14h-5L2 10.5v-5z" />
          <path d="M5 8h6" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M6.5 5.5v5M9.5 5.5v5" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M8 2.2l6.2 11H1.8z" />
          <path d="M8 6.5v3M8 11.4v.1" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M8 1.8L14.2 8 8 14.2 1.8 8z" />
          <path d="M8 5.2v3.6M8 10.8v.1" />
        </svg>
      );
    case "hourglass":
      return (
        <svg {...common}>
          <path d="M4 2h8M4 14h8M5 2c0 3 6 3 6 6s-6 3-6 6M11 2c0 3-6 3-6 6s6 3 6 6" />
        </svg>
      );
    case "square-dashed":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2.4 2.4" />
        </svg>
      );
    case "branch":
      return (
        <svg {...common}>
          <circle cx="4.5" cy="3.5" r="1.5" />
          <circle cx="4.5" cy="12.5" r="1.5" />
          <circle cx="11.5" cy="6" r="1.5" />
          <path d="M4.5 5v6M11.5 7.5c0 2.5-4 2-6.5 4" />
        </svg>
      );
  }
}

export function StatusBadge({ status, compact = false }: { status: StatusDef; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip border font-medium whitespace-nowrap ${
        compact ? "px-1.5 py-px text-xs" : "px-2 py-0.5 text-xs"
      } ${TONE_CLASS[status.tone]}`}
      data-tone={status.tone}
    >
      <StatusGlyph glyph={status.glyph} />
      <span className="sr-only">{status.family}: </span>
      {status.label}
    </span>
  );
}
