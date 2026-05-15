"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function ModulesPage() {
  const content = {
  "shape": "viewer",
  "title": "",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
