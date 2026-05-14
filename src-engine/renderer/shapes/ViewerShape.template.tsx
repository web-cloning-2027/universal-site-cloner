/**
 * ViewerShape — read-only fallback when no other shape matches.
 *
 * Renders breadcrumbs, h1, banners, and a JSON dump of the leafContent
 * for unclassified leaves. The audit Diff will flag mis-classifications
 * separately; this is the safe default that never crashes.
 *
 * Generic: zero site-specific content.
 */
type AnyContent = {
  title?: string;
  h1?: string;
  breadcrumbs?: string[];
  pageInfoBanners?: { level: string; text: string }[];
  panels?: { label: string; fields: { label: string; kind: string }[] }[];
  tables?: { columns: string[] }[];
};

export function ViewerShape({ content }: { content: AnyContent }) {
  return (
    <main className="p-6 space-y-5 bg-[color:var(--page,_white)] flex-1">
      {content.breadcrumbs && content.breadcrumbs.length > 0 ? (
        <nav className="text-xs text-gray-700 flex flex-wrap gap-1 items-center">
          {content.breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>{b}</span>
              {i < content.breadcrumbs!.length - 1 ? <span className="text-gray-400">›</span> : null}
            </span>
          ))}
        </nav>
      ) : null}
      {content.h1 ? <h1 className="text-2xl font-semibold">{content.h1}</h1> : null}
      {(content.pageInfoBanners ?? []).map((b, i) => (
        <div
          key={i}
          role="alert"
          className={`rounded border-l-4 p-3 text-sm ${
            b.level === "error"
              ? "border-rose-500 bg-rose-50 text-rose-900"
              : b.level === "warning"
              ? "border-amber-500 bg-amber-50 text-amber-900"
              : b.level === "success"
              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
              : "border-blue-500 bg-blue-50 text-blue-900"
          }`}
        >
          {b.text}
        </div>
      ))}
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500">leafContent (raw)</summary>
        <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3">{JSON.stringify(content, null, 2)}</pre>
      </details>
    </main>
  );
}
