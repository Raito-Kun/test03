# Thread K — Detail Pages M3 Lavender Alignment

**Date:** 2026-05-04 | **Branch:** feat/ui-ops-console-redesign

## Files Modified

- `pages/contacts/contact-detail.tsx` — full rewrite to header card + 8/4 grid + tabs (like lead-detail)
- `pages/contacts/contact-detail-dialog.tsx` — section headers → mono uppercase dashed dividers; Field/SelectField labels → mono uppercase; inputs h-42px
- `pages/contacts/contact-import-wizard.tsx` — Stepper → numbered circles + dashed line connectors, mono uppercase labels
- `pages/contacts/contact-import-step-preview.tsx` — table → dashed border rounded-xl, mono header row, NEW pill (green)
- `pages/contacts/contact-import-step-dedup.tsx` — DuplicateCard → dashed border rounded-xl, mono field labels, green/amber diff highlights
- `pages/contacts/contact-merge-dialog.tsx` — violet primary title, dashed border cards, M3 footer
- `pages/contacts/contact-form.tsx` — SectionTitle → dashed border mono uppercase; Field label → mono uppercase; select h-42px; footer border-dashed
- `pages/contacts/call-history-tab.tsx` — full rewrite: vertical dashed connector, status pills (✓ Đã trả lời / ✗ Cuộc gọi nhỡ), mono timestamps
- `pages/leads/lead-form.tsx` — section groups + dashed dividers + mono labels + h-42px inputs + violet Save button
- `pages/debt-cases/debt-case-detail.tsx` — full rewrite: header card + DPD pill + KPI tile row + 8/4 grid tabs + right rail timeline

## TSC Result

- **Pre-existing errors:** 3 (cluster-detail-form.tsx — not in scope)
- **Owned files errors:** 0
- **Status:** PASS

## Status

DONE

## Concerns / Unresolved Questions

- `contact-import-step-assign.tsx` — no structural changes applied (layout is functional table/grid, minimal M3 touch would just be border-dashed on the container; left as-is per KISS/YAGNI since the spec says "minor M3 styling" and the component renders inside the wizard dialog which already has M3 chrome)
- `contact-detail-dialog.tsx` — the `cn` import was already absent; `selectClass` height updated to h-[42px] inside the dialog inline form. The dialog select uses a raw `<select>` with the updated class string — consistent with existing pattern.
- `debt-case-detail.tsx` — `SectionHeader` import removed (replaced by inline header card pattern matching lead-detail). The `SectionHeader` component from ops/ is no longer used in this file.
