"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function PriceChangesAuditReportPage() {
  const content = {
  "shape": "viewer",
  "title": "Price Changes Audit Report",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
