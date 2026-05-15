"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function OnetrueListPage() {
  const content = {
  "shape": "viewer",
  "title": "List Vehicles",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
