"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function WorkListPage() {
  const content = {
  "shape": "viewer",
  "title": "Work List",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
