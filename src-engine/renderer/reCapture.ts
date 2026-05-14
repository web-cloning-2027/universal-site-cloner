/**
 * reCapture — derives the "clone manifest" from the EMITTED Next.js
 * source tree. This is what the engine ACTUALLY rendered, not what it
 * intended to render.
 *
 * Walks <cloneDir>/src/components/*.tsx, parses each emitted leaf's
 * `const content = {...}` literal (a JSON dump of leafContent the
 * Scaffold inlined), and rebuilds a Manifest with the actual emitted
 * shape per URL.
 *
 * The DIFF between this re-captured manifest and the live-manifest IS
 * the gap class the audit was designed to surface (R4). Without this
 * step, the audit's "compare manifests" was comparing a live manifest
 * to itself — auto-trivially clean.
 *
 * Generic: any site-cloning engine that emits clone source must
 * surface what it actually emitted, separately from what it was told
 * to emit, so the renderer's losses become visible.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Leaf, LeafContent, LeafShape, Manifest } from "../manifest.js";

const COMPONENT_FILE_RE = /\.tsx$/;
const CONTENT_LITERAL_RE = /const\s+content\s*=\s*(\{[\s\S]*?\});/;
const SHAPE_IMPORT_RE =
  /import\s*\{\s*(DetailFormShape|DataGridShape|DashboardShape|WizardShape|ViewerShape)\s*\}/;

interface EmittedComponent {
  componentFile: string;
  shape: LeafShape;
  content: LeafContent;
  routePath?: string;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(p, out);
    else if (s.isFile()) out.push(p);
  }
  return out;
}

/** Try to recover the original URL the renderer used for this leaf.
 *  Scaffold writes "@/components/<Name>Page" — we don't preserve URLs
 *  in component files. The companion manifest in data/<name>-manifest.json
 *  is the source of truth for URL→component mapping. */
function urlsFromManifest(
  dataManifestPath: string,
): Map<string, { url: string; shape: LeafShape; leafContent: LeafContent }> {
  const map = new Map<string, { url: string; shape: LeafShape; leafContent: LeafContent }>();
  if (!existsSync(dataManifestPath)) return map;
  try {
    const m = JSON.parse(readFileSync(dataManifestPath, "utf-8")) as Manifest;
    for (const leaf of m.leaves) {
      const compName = componentNameForUrl(leaf.url);
      const lc = leaf.leafContent;
      if (!lc) continue;
      const shape: LeafShape =
        leaf.kind ?? lc.shape ?? "viewer";
      map.set(compName, { url: leaf.url, shape, leafContent: lc });
    }
  } catch {
    // ignore parse errors; just produce a smaller map
  }
  return map;
}

function componentNameForUrl(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname.replace(/\.php$/, "");
    p = p.replace(/\/+/g, "/").replace(/\/$/, "");
    p = p.replace(/:(\w+)/g, "[$1]");
    // Mirror Scaffold.urlToPath: append query-string keys as a path
    // suffix so canonical-with-query URLs (e.g. ?id=:id vs ?vehicle_id=:id)
    // get distinct componentName / route paths.
    if (u.search) {
      const keys = [...new URLSearchParams(u.search).keys()]
        .map((k) => k.replace(/[^a-z0-9]+/gi, ""))
        .filter(Boolean);
      if (keys.length > 0) p = p + "/" + keys.join("-").toLowerCase();
    }
    const segs = p
      .replace(/^\//, "")
      .replace(/\[(\w+)\]/g, "$1")
      .split(/[\/\-_.]/)
      .filter(Boolean);
    return segs.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") + "Page";
  } catch {
    return "UnknownPage";
  }
}

/** Parse one emitted component file, recovering its embedded shape + content. */
function parseComponent(filePath: string): EmittedComponent | null {
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const shapeMatch = text.match(SHAPE_IMPORT_RE);
  const contentMatch = text.match(CONTENT_LITERAL_RE);
  if (!shapeMatch || !contentMatch) return null;
  const shapeName = shapeMatch[1] as
    | "DetailFormShape"
    | "DataGridShape"
    | "DashboardShape"
    | "WizardShape"
    | "ViewerShape";
  const shape: LeafShape = ({
    DetailFormShape: "form",
    DataGridShape: "grid",
    DashboardShape: "dashboard",
    WizardShape: "wizard",
    ViewerShape: "viewer",
  } as const)[shapeName];
  let content: LeafContent;
  try {
    // The literal is JSON-formatted JSON.stringify output (with double
    // quotes), so JSON.parse should work directly.
    content = JSON.parse(contentMatch[1]!) as LeafContent;
  } catch {
    return null;
  }
  return { componentFile: filePath, shape, content };
}

/**
 * Walk the emitted clone tree and rebuild a Manifest.
 * Cross-references with the companion data/<configName>-manifest.json
 * to recover URLs (since component files don't carry their source URL).
 */
export function reCaptureCloneManifest(
  cloneDir: string,
  configName: string,
): Manifest {
  const componentsDir = resolve(cloneDir, "src/components");
  const dataManifestPath = resolve(cloneDir, "data", `${configName}-manifest.json`);
  const liveBacking = urlsFromManifest(dataManifestPath);

  const components = walk(componentsDir).filter(
    (p) => COMPONENT_FILE_RE.test(p) && !p.includes("/shapes/"),
  );

  const leaves: Leaf[] = [];
  for (const file of components) {
    const parsed = parseComponent(file);
    if (!parsed) continue;
    // Component file basename like "AccountsCapitalExpensesAddPage.tsx"
    const base = file.split("/").pop()!.replace(/\.tsx$/, "");
    const backing = liveBacking.get(base);
    leaves.push({
      url: backing?.url ?? `(emitted:${base})`,
      status: 200,
      kind: parsed.shape,
      leafContent: {
        ...parsed.content,
        shape: parsed.shape,
      },
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    configName,
    seedUrls: [],
    leafCount: leaves.length,
    leaves,
  };
}
