/**
 * FormExtractor — closes GAP-06 (multi-section forms with per-field
 * kind capture).
 *
 * Segments forms into panels by:
 *   - <fieldset> (canonical HTML grouping)
 *   - <section class*=panel-outer> / <section class*=panel> / .panel
 *   - <form> top-level then by H2/H3 within
 *
 * Per panel, enumerates inputs/selects/textareas (skipping hidden,
 * submit, button, search) and captures {label, kind, options,
 * defaultValue, required, placeholder, helpText}.
 *
 * Generic: no per-site logic. The selectors are CSS classes that
 * appear across hand-built and Bootstrap-style CRMs alike. If a
 * future site uses entirely different conventions, the config's
 * `hints.formPanelSelector` could override (added when the gap
 * appears, not pre-emptively).
 */

import type { Page } from "playwright";
import { TEXT_HELPERS } from "./text.js";
import type { FormSection } from "../manifest.js";

const PANEL_SELECTOR =
  "fieldset, section[class*='panel-outer' i], " +
  "section[class*='panel' i], .panel, " +
  "[role='group']";

export async function extractForm(page: Page): Promise<FormSection[]> {
  const script = `(() => {
    ${TEXT_HELPERS}
    function labelFor(input) {
      // <label for=...>, ancestor <label>, aria-labelledby, aria-label, placeholder
      const id = input.getAttribute("id");
      if (id) {
        const lbl = document.querySelector("label[for='" + id + "']");
        if (lbl) return spaceyText(lbl);
      }
      const ancestor = input.closest("label");
      if (ancestor) return spaceyText(ancestor);
      const labelledBy = input.getAttribute("aria-labelledby");
      if (labelledBy) {
        const el = document.getElementById(labelledBy);
        if (el) return spaceyText(el);
      }
      return input.getAttribute("aria-label")
        || input.getAttribute("placeholder")
        || input.getAttribute("name")
        || "";
    }
    function inputKind(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === "select") return "select";
      if (tag === "textarea") return "textarea";
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (["checkbox","radio","date","number","file","color","range"].includes(t)) return t;
      return "text";
    }
    function describeField(el) {
      const kind = inputKind(el);
      const label = labelFor(el);
      const field = { label, kind };
      if (kind === "select") {
        field.options = [...el.querySelectorAll("option")].map(o => spaceyText(o)).filter(Boolean);
        const sel = el.querySelector("option[selected]");
        if (sel) field.defaultValue = spaceyText(sel);
      } else {
        const dv = el.getAttribute("value");
        if (dv) field.defaultValue = dv;
        const placeholder = el.getAttribute("placeholder");
        if (placeholder) field.placeholder = placeholder;
      }
      if (el.hasAttribute("required")) field.required = true;
      return field;
    }
    const panels = qsa(${JSON.stringify(PANEL_SELECTOR)});
    if (panels.length === 0) {
      // Fall back: treat the whole content root as one implicit panel.
      const inputs = qsa("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]), select, textarea");
      if (inputs.length === 0) return [];
      // Cap fields so we don't drown the manifest in a single mega-panel.
      return [{ label: "", fields: inputs.slice(0, 200).map(describeField) }];
    }
    return panels.map(p => {
      const title = p.querySelector("h1, h2, h3, h4, legend, .panel-title, .panel-heading");
      const inputs = [...p.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]), select, textarea")];
      return {
        label: title ? spaceyText(title) : "",
        fields: inputs.map(describeField),
      };
    }).filter(p => p.fields.length > 0);
  })()`;
  return (await page.evaluate(script)) as FormSection[];
}
