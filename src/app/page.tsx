import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

function listRoutes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith("_") || name.startsWith(".") || name === "page.tsx" || name === "layout.tsx" || name === "globals.css" || name === "favicon.ico") continue;
      const p = resolve(dir, name);
      if (statSync(p).isDirectory()) out.push(...listRoutes(p, prefix + "/" + name));
      else if (name === "page.tsx") out.push(prefix || "/");
    }
  } catch {}
  return out;
}

export default function Home() {
  const routes = listRoutes(resolve(process.cwd(), "src/app")).sort();
  return (
    <main style={{padding:"2rem",fontFamily:"system-ui,sans-serif",background:"white",minHeight:"100vh"}}>
      <h1 style={{fontSize:"1.5rem",fontWeight:600,marginBottom:"1rem"}}>Universal Site Cloner — emitted ClickDealer clone</h1>
      <p style={{fontSize:"0.875rem",color:"#666",marginBottom:"1.5rem"}}>{routes.length} routes emitted by the engine from a cold wet-test run.</p>
      <ul style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.25rem",fontSize:"0.875rem",listStyle:"none",padding:0}}>
        {routes.map((r) => (
          <li key={r}><a style={{color:"#1d4ed8",textDecoration:"none"}} href={r}>{r}</a></li>
        ))}
      </ul>
    </main>
  );
}
