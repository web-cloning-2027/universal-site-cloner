"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function SalesEnquiriesPage() {
  const content = {
  "shape": "viewer",
  "title": "Sales Enquiries",
  "h1": "Sales Enquiries",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
