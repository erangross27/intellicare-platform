# IntelliCare agent instructions

## Artifact template work: completion is evidence, not a promise

For every change under `apps/frontend-vite/src/components/artifact/templates/` or
`apps/frontend-vite/src/components/artifact/pdf-templates/`, follow the complete
one-pass rules injected by `claude-hooks/user-prompt-search.sh` and
`claude-hooks/pre-tool-use.sh`. The rules below are additional hard gates.

1. **Lock the target before editing.** Record the tracker row and prompt, Mongo
   collection, JSX component, PDF component, and exact real-record reference.
   If the user changes the target, discard the old lock and resolve all six again.
2. **Use two kinds of evidence.** Audit the full real Mongo record. For every
   modified generic-renderer branch that record does not populate, also audit a
   minimal non-PHI shape fixture. When the user reports an exact visible value,
   reproduce that value in addition to the Mongo baseline. Keep record and shape
   fixtures outside the repository.
3. **Honor the editable-leaf DOM contract.** `data-edit-field` belongs on a
   wrapper that *contains* exactly one `.numbered-row.editable-row` or editable
   subtitle. Never put it on the clickable row itself: the harness deliberately
   searches descendants with `querySelector()`.
4. **Use semantic mini-card grouping.** One labeled mini-card contains its
   subtitle and all rows in that group. One consecutive unlabeled run shares one
   subtitle-free mini-card; never create one card per unlabeled row. The newer
   grouped-unlabeled rule supersedes any older per-row mini-card instruction.
5. **Run the durable completion gate.** Use
   `node scripts/completeTemplateAudit.mjs <TemplateName> --target /tmp/<lock>.json`
   from `apps/frontend-vite`. Do not declare completion or mark the tracker blue
   unless it exits zero. The gate runs the real record and every declared branch
   fixture through `auditTemplate.mjs`.
6. **Verify PDF selection, not only PDF source.** Check both the direct component
   import and `pdf-templates/index.js` for stale or legacy mappings. Render the
   selected PDF and verify the canonical 26/19/16/13/14 typography.
7. **Tracker readback is mandatory.** Prefer the connected Excel session when it
   is available: read the exact row, format A:D solid `#00B0F0`, then read back
   values and styles (and an image when available). Use an offline workbook tool
   only when no live Excel session exists. Never blue a row before the completion
   gate succeeds.

Browser control is discovered per agent surface and session. A Chrome extension
or a browser connection in the ChatGPT app does not prove that terminal Codex has
the same connection; check the available capability before promising browser QA.

Never send patient-associated values, credentials, source code, or private paths
to memory/session tools. IntelliCare session state remains local-only.
