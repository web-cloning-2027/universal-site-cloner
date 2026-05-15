"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function StockPriceUpdatesPage() {
  const content = {
  "shape": "viewer",
  "title": "Stock Price Updates",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
