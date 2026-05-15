"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function SlmPerformancePage() {
  const content = {
  "shape": "viewer",
  "title": "Slm - Performance",
  "h1": "Performance Report",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
