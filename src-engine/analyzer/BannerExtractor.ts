/**
 * BannerExtractor — closes GAP-12 (info-banner parity).
 *
 * Captures `[role=alert]`, `[class*=alert|notice|warning|banner|info]`,
 * and "Please Note …" paragraphs. Returns short, palette-hinted entries.
 *
 * Generic: the "Please Note" English idiom is widely used in
 * dealer/CRM software but won't false-positive on most sites — it
 * requires the paragraph to start with that literal phrase. If a
 * future site uses different phrasing, the only failure mode is
 * "banner not captured", which the audit flags as GAP-12 and we
 * extend.
 */

import type { Page } from "playwright";
import { TEXT_HELPERS } from "./text.js";
import type { PageInfoBanner } from "../manifest.js";

const BANNER_SELECTOR =
  "main [role='alert'], " +
  "main [class*='alert' i], main [class*='notice' i], " +
  "main [class*='warning' i], main [class*='banner' i], " +
  "main [class*='info-banner' i]";

export async function extractBanners(page: Page): Promise<PageInfoBanner[]> {
  const script = `(() => {
    ${TEXT_HELPERS}
    function levelOf(el) {
      const cls = (el.className || "") + " " + (el.getAttribute("role") || "");
      const c = cls.toLowerCase();
      if (/error|danger|destruct|red/.test(c)) return "error";
      if (/warn|alert|amber|yellow/.test(c)) return "warning";
      if (/success|ok|green/.test(c)) return "success";
      return "info";
    }
    const out = [];
    for (const el of document.querySelectorAll(${JSON.stringify(BANNER_SELECTOR)})) {
      const text = spaceyText(el);
      if (text && text.length > 2 && text.length < 600) {
        out.push({ level: levelOf(el), text });
      }
    }
    // "Please Note …" paragraphs.
    for (const p of document.querySelectorAll("main p")) {
      const text = spaceyText(p);
      if (/^Please Note\\b/.test(text) && text.length < 600 && !out.find(o => o.text === text)) {
        out.push({ level: "warning", text });
      }
    }
    return out;
  })()`;
  return (await page.evaluate(script)) as PageInfoBanner[];
}
