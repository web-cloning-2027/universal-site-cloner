/**
 * Renderer scaffold — closes GAP-17 (clone-tree emission from manifest).
 *
 * Walks a Manifest and emits, into an output directory:
 *   - src/app/<path>/page.tsx         (route stub)
 *   - src/components/<Name>Page.tsx   (component, picks a shape)
 *   - data/<config-name>-leaves.json  (the manifest, for downstream tools)
 *
 * Generic: the path layout follows the ORIGINAL template's
 * src/app/ + src/components/ convention (R16 — preserve and emit-into).
 *
 * Per-shape components live in renderer/shapes/. The renderer reads
 * `leaf.kind || leaf.leafContent.shape`, picks a shape file, and
 * instantiates it with the manifest's leafContent as props.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Leaf, LeafShape, Manifest } from "../manifest.js";

const SHAPES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "shapes",
);

export interface ScaffoldArgs {
  manifest: Manifest;
  outDir: string;
  /** Allowlist for which URL host prefixes to strip when building paths. */
  hostPrefixes?: string[];
}

export class Scaffold {
  constructor(private readonly args: ScaffoldArgs) {}

  emit(): { routesEmitted: number; componentsEmitted: number } {
    const outRoot = resolve(this.args.outDir);
    let routes = 0;
    let comps = 0;
    for (const leaf of this.args.manifest.leaves) {
      if (leaf.kind === "endpoint") continue; // R7-like rule: endpoints don't get pages.
      const clonePath = this.urlToPath(leaf.url);
      if (!clonePath || clonePath === "/") continue;
      const componentName = this.componentName(clonePath);
      const shape: LeafShape =
        leaf.kind || leaf.leafContent?.shape || "viewer";
      const componentSrc = this.componentSource(componentName, shape, leaf);
      const compPath = resolve(
        outRoot,
        "src/components",
        `${componentName}.tsx`,
      );
      const routePath = resolve(
        outRoot,
        "src/app",
        clonePath.replace(/^\//, ""),
        "page.tsx",
      );
      mkdirSync(dirname(compPath), { recursive: true });
      writeFileSync(compPath, componentSrc);
      comps++;
      mkdirSync(dirname(routePath), { recursive: true });
      writeFileSync(routePath, this.routeSource(componentName));
      routes++;
    }
    // Manifest dump for the renderer's downstream consumers.
    const dataDir = resolve(outRoot, "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      resolve(dataDir, `${this.args.manifest.configName}-manifest.json`),
      JSON.stringify(this.args.manifest, null, 2),
    );

    // Copy the shape templates into the output's
    // src/components/shapes/ — without these the generated `page.tsx`
    // files won't compile.
    this.copyShapeTemplates(resolve(outRoot, "src/components/shapes"));

    return { routesEmitted: routes, componentsEmitted: comps };
  }

  private copyShapeTemplates(dstDir: string): void {
    mkdirSync(dstDir, { recursive: true });
    if (!existsSync(SHAPES_DIR)) return;
    for (const file of readdirSync(SHAPES_DIR)) {
      if (!file.endsWith(".template.tsx")) continue;
      const dst = file.replace(/\.template\.tsx$/, ".tsx");
      copyFileSync(resolve(SHAPES_DIR, file), resolve(dstDir, dst));
    }
  }

  private urlToPath(url: string): string {
    try {
      const u = new URL(url);
      let p = u.pathname.replace(/\.php$/, "");
      // Collapse double slashes, trim trailing.
      p = p.replace(/\/+/g, "/").replace(/\/$/, "");
      // :id placeholders → Next.js [id] route segments.
      p = p.replace(/:(\w+)/g, "[$1]");
      return p || "/";
    } catch {
      return "/";
    }
  }

  private componentName(path: string): string {
    const segs = path
      .replace(/^\//, "")
      .replace(/\[(\w+)\]/g, "$1")
      .split(/[\/\-_.]/)
      .filter(Boolean);
    return (
      segs
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("") + "Page"
    );
  }

  private routeSource(componentName: string): string {
    return `import { ${componentName} } from "@/components/${componentName}";

export const metadata = { title: "${componentName.replace(/Page$/, "")}" };

export default function Page() {
  return <${componentName} />;
}
`;
  }

  private componentSource(
    componentName: string,
    shape: LeafShape,
    leaf: Leaf,
  ): string {
    const shapeImport = ({
      form: "DetailFormShape",
      grid: "DataGridShape",
      dashboard: "DashboardShape",
      wizard: "WizardShape",
      viewer: "ViewerShape",
      "section-landing": "ViewerShape",
      endpoint: "ViewerShape",
    } as const)[shape];
    const props = JSON.stringify(leaf.leafContent ?? {}, null, 2);
    return `"use client";
import { ${shapeImport} } from "@/components/shapes/${shapeImport}";

export function ${componentName}() {
  const content = ${props};
  return <${shapeImport} content={content as any} />;
}
`;
  }
}
