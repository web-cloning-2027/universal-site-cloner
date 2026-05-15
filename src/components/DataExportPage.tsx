"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function DataExportPage() {
  const content = {
  "shape": "viewer",
  "title": "Data Export",
  "h1": "Data Export",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
