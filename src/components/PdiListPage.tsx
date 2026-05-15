"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function PdiListPage() {
  const content = {
  "shape": "viewer",
  "title": "Pdi List",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
