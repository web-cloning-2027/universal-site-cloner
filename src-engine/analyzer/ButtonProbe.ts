/**
 * ButtonProbe — closes GAP-10 (every interactive element classified).
 *
 * Enumerates `<button>` and `<a>` action-styled elements. For each:
 *   - if `<a href>` resolves to a route in-host, kind="route"
 *   - if href is external, kind="external"
 *   - if href is mailto:/tel:/javascript:void(0), kind="dead" / "external"
 *   - if button is a `data-modal` / `data-bs-toggle="modal"`, kind="modal"
 *   - if button is the trigger of a visible menu/dropdown, kind="menu"
 *   - if href points to a downloadable file (extension match), kind="download"
 *   - otherwise we record kind="dead" with a TODO-free reason
 *
 * We do NOT click every button at this stage (would be flaky and slow).
 * A future analyzer pass (`button-click-probe`) can resolve ambiguous
 * cases by opening each in a fresh tab. That extension is gated by an
 * actual gap appearing in audit, not pre-emptively.
 */

import type { Page } from "playwright";
import type { Button, ButtonKind } from "../manifest.js";

const DOWNLOAD_EXT_RE = /\.(?:csv|xlsx?|pdf|zip|docx?|pptx?|xml|json)$/i;

export async function probeButtons(page: Page): Promise<Button[]> {
  const script = `
    function spaceyText(el) {
      if (!el) return "";
      const clone = el.cloneNode(true);
      for (const br of clone.querySelectorAll("br")) br.replaceWith(document.createTextNode(" "));
      return (clone.textContent || "").replace(/\\s+/g, " ").trim();
    }
    const origin = window.location.origin;
    const out = [];
    for (const el of document.querySelectorAll("main button, main a[href], main [role='button']")) {
      const text = spaceyText(el);
      if (!text) continue;
      const tag = el.tagName.toLowerCase();
      let kind = "dead";
      let destination;
      if (tag === "a" && el.hasAttribute("href")) {
        const href = el.getAttribute("href");
        destination = href;
        try {
          if (!href || href === "#" || /^javascript:/.test(href)) {
            kind = "dead";
          } else if (/^mailto:|^tel:/.test(href)) {
            kind = "external";
          } else if (${DOWNLOAD_EXT_RE.toString()}.test(href) || el.hasAttribute("download")) {
            kind = "download";
          } else {
            const url = new URL(href, window.location.href);
            kind = url.origin === origin ? "route" : "external";
            destination = url.toString();
          }
        } catch (e) {
          kind = "dead";
        }
      } else {
        // <button> or [role=button]
        if (el.matches("[data-bs-toggle='modal'], [data-modal], [aria-haspopup='dialog']")) {
          kind = "modal";
        } else if (el.matches("[aria-haspopup='menu'], [data-bs-toggle='dropdown']")) {
          kind = "menu";
        } else if (el.matches("[type='submit']")) {
          kind = "route";
          destination = "(form submit)";
        } else {
          // We don't know; record dead and let the audit elevate it if needed.
          kind = "dead";
        }
      }
      out.push({ label: text, kind, destination });
    }
    return out;
  `;
  const raw = (await page.evaluate(script)) as Array<{
    label: string;
    kind: ButtonKind;
    destination?: string;
  }>;
  // Dedupe by (label, kind, destination) — long lists of identical
  // pagination links shouldn't pollute the manifest.
  const seen = new Set<string>();
  const out: Button[] = [];
  for (const b of raw) {
    const key = `${b.label}\0${b.kind}\0${b.destination ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}
