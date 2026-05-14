/**
 * LeafAnalyzer — drives the per-leaf analysis pass.
 *
 * Closes GAP-05 (shape detection), GAP-06/07/08 (form/grid/kind),
 * GAP-09 (nested tabs), GAP-10/11 (button + action menu probes),
 * GAP-12 (info banners), GAP-21 (whitespace preservation).
 *
 * The orchestration here is generic; site-specific selectors live in
 * the site config under `hints` (R2). Per-extractor logic lives in
 * sibling files.
 */

import type { Page } from "playwright";
import { extractForm } from "./FormExtractor.js";
import { extractGrids } from "./GridExtractor.js";
import { extractBanners } from "./BannerExtractor.js";
import { recurseTabs } from "./TabRecursor.js";
import { probeButtons } from "./ButtonProbe.js";
import { probeActionMenus } from "./ActionMenuProbe.js";
import { classifyShape } from "./classifyShape.js";
import type { Leaf, LeafContent, LeafShape } from "../manifest.js";
import type { SiteConfig } from "../config.js";

export interface AnalyzeArgs {
  url: string;
  status: number;
  page: Page;
}

export interface LeafAnalyzerConfig {
  /** Engine-level config for shape overrides etc. */
  hints?: SiteConfig["hints"];
  /** Hard cap on tab-recursion depth, for safety. The crawler's
   *  R11 ban on caps applies to URLs, not to in-page recursion of
   *  the same URL — but unbounded recursion in a malicious DOM is a
   *  liveness risk. Default 8. */
  maxTabDepth?: number;
}

export class LeafAnalyzer {
  constructor(private readonly config: LeafAnalyzerConfig = {}) {}

  async analyze(args: AnalyzeArgs): Promise<Leaf> {
    const { url, status, page } = args;

    // Apply config-driven kind overrides first (endpoint / section-landing).
    const kindOverride = this.classifyKind(url);

    if (kindOverride === "endpoint") {
      return {
        url,
        status,
        kind: "endpoint",
        leafContent: { shape: "endpoint" },
        childUrls: [],
      };
    }
    if (kindOverride === "section-landing") {
      return {
        url,
        status,
        kind: "section-landing",
        leafContent: { shape: "section-landing" },
        childUrls: await this.extractChildUrls(page),
      };
    }

    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(200);

    const [breadcrumbs, h1, title] = await Promise.all([
      page.$$eval("nav[aria-label='breadcrumb'] a, .breadcrumbs a", (els) =>
        els.map((e) => (e.textContent || "").trim()).filter(Boolean),
      ).catch(() => [] as string[]),
      page.$eval("h1", (el) => (el.textContent || "").trim()).catch(() => undefined),
      page.title().catch(() => undefined),
    ]);

    const panels = await extractForm(page);
    const tables = await extractGrids(page);
    const pageInfoBanners = await extractBanners(page);
    const buttons = await probeButtons(page);
    const actionMenus = await probeActionMenus(page);

    const shape: LeafShape = await classifyShape({
      url,
      panels,
      tables,
      buttons,
      shapeOverrides: this.config.hints?.shapeOverrides,
    });

    const leafContent: LeafContent = {
      shape,
      title,
      h1,
      breadcrumbs,
      panels,
      tables,
      buttons,
      actionMenus,
      pageInfoBanners,
    };

    const tabs = await recurseTabs({
      page,
      depth: 0,
      maxDepth: this.config.maxTabDepth ?? 8,
    });

    const childUrls = await this.extractChildUrls(page);

    return {
      url,
      status,
      kind: shape,
      leafContent,
      tabs,
      childUrls,
    };
  }

  /**
   * Apply hint-pattern URL overrides. Returns "endpoint" or
   * "section-landing" if a pattern matches, else undefined.
   */
  private classifyKind(
    url: string,
  ): "endpoint" | "section-landing" | undefined {
    const ep = this.config.hints?.endpointPatterns ?? [];
    for (const p of ep) if (new RegExp(p).test(url)) return "endpoint";
    const sl = this.config.hints?.sectionLandingPatterns ?? [];
    for (const p of sl) if (new RegExp(p).test(url)) return "section-landing";
    return undefined;
  }

  private async extractChildUrls(page: Page): Promise<string[]> {
    return page
      .$$eval("a[href]", (links) =>
        links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => /^https?:\/\//.test(h)),
      )
      .catch(() => [] as string[]);
  }
}
