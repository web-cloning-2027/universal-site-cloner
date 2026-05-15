"use client";
import { ViewerShape } from "@/components/shapes/ViewerShape";

export function HomePage() {
  const content = {
  "shape": "viewer",
  "title": "DMS",
  "h1": "Hi Roy,",
  "breadcrumbs": [],
  "panels": [],
  "tables": [],
  "buttons": [
    {
      "label": "Manage Stock",
      "kind": "external",
      "destination": "https://myclickdealer.co.uk/work_list.php"
    },
    {
      "label": "Manage Stock",
      "kind": "dead"
    },
    {
      "label": "Find Vehicle",
      "kind": "route",
      "destination": "(form submit)"
    },
    {
      "label": "Sales Enquiries",
      "kind": "external",
      "destination": "https://myclickdealer.co.uk/sales_enquiries.php"
    },
    {
      "label": "Work List",
      "kind": "external",
      "destination": "https://myclickdealer.co.uk/work_list.php"
    },
    {
      "label": "Read more",
      "kind": "external",
      "destination": "https://www.clickdealer.co.uk/#wpcf7-f1461-o1"
    },
    {
      "label": "Read more",
      "kind": "dead"
    },
    {
      "label": "Go to slide 1",
      "kind": "dead"
    },
    {
      "label": "Go to slide 2",
      "kind": "dead"
    },
    {
      "label": "Go to slide 3",
      "kind": "dead"
    },
    {
      "label": "Go to slide 4",
      "kind": "dead"
    },
    {
      "label": "Go to slide 5",
      "kind": "dead"
    },
    {
      "label": "Go to slide 6",
      "kind": "dead"
    },
    {
      "label": "Go to slide 7",
      "kind": "dead"
    }
  ],
  "actionMenus": [],
  "pageInfoBanners": []
};
  return <ViewerShape content={content as any} />;
}
