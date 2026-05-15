"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function UserListPage() {
  const content = {
  "shape": "viewer",
  "title": "User List",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
