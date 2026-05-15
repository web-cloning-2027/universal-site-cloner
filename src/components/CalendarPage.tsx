"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function CalendarPage() {
  const content = {
  "shape": "viewer",
  "title": "Calendar",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
