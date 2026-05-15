/**
 * Browser-side text extraction helpers. Ported from the gold-standard
 * `crawl-leaf-content.mjs` captureFn. GENERICALLY phrased — no site-
 * specific selectors.
 *
 * GAP-21: `<br>` between words is treated as a single space, then
 * whitespace runs collapse to one. This preserves "Reset Email" as
 * two tokens, not "ResetEmail".
 *
 * These functions are stringified and injected into the page via
 * page.evaluate. They do NOT use any Node imports.
 */

export const TEXT_HELPERS = `
function spaceyText(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  for (const br of clone.querySelectorAll("br")) {
    br.replaceWith(document.createTextNode(" "));
  }
  return (clone.textContent || "").replace(/\\s+/g, " ").trim();
}
function classifyInputKind(td) {
  if (!td) return "value";
  if (td.querySelector("input[type='checkbox']")) return "checkbox";
  if (td.querySelector("input[type='radio']")) return "radio";
  if (td.querySelector("select")) return "select";
  const dt = td.querySelector("input[type='date'], input[type='month'], input[type='time'], input[type='datetime-local']");
  if (dt) return dt.getAttribute("type") || "date";
  if (td.querySelector("input[type='number']")) return "number";
  if (td.querySelector("textarea")) return "textarea";
  if (td.querySelector("input[type='text'], input:not([type])")) return "text";
  return "value";
}
/** Find the page's main content root.
 *  Modern HTML5 sites use <main>; legacy / pre-HTML5 (PHP, classic CMS)
 *  put everything in body. Falls back to body excluding nav/header/footer
 *  so we don't accidentally count sidebar links as page content.
 *  Generic across HTML eras.
 */
function contentRoot() {
  return document.querySelector("main") || document.body || document.documentElement;
}
/** querySelectorAll, scoped to contentRoot. */
function qsa(selector) {
  const root = contentRoot();
  if (!root) return [];
  return [...root.querySelectorAll(selector)];
}
`;
