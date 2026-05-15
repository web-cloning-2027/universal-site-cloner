"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function SaleOrReturnReportPage() {
  const content = {
  "shape": "viewer",
  "title": "Sale Or Return Report",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
