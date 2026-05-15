"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function SlmDashboardPage() {
  const content = {
  "shape": "viewer",
  "title": "Slm - Dashboard",
  "h1": "Dashboard",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
