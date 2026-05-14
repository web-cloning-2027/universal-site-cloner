/**
 * DashboardShape — mixed-content leaf with both form-style panels and
 * data grids. Minimum-viable composes DetailFormShape's panels + a
 * compact grid block, in vertical order.
 */

import { DataGridShape } from "./DataGridShape.template.js";
import { DetailFormShape } from "./DetailFormShape.template.js";

type AnyContent = Parameters<typeof DataGridShape>[0]["content"] &
  Parameters<typeof DetailFormShape>[0]["content"];

export function DashboardShape({ content }: { content: AnyContent }) {
  return (
    <>
      <DetailFormShape content={content} />
      <DataGridShape content={content} />
    </>
  );
}
