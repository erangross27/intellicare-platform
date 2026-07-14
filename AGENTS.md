# IntelliCare agent instructions

## GitHub automation: cloud CI and Pages are prohibited

GitHub is source control only for this repository. Do not create, restore, edit,
enable, dispatch, run, or rerun GitHub Actions workflows. Do not create or
publish a GitHub Pages site. Ordinary local checks, commits, and pushes are
allowed, but a push must not start a GitHub-hosted job.

Do not use `gh`, the GitHub API, or the GitHub web interface for status checks.
Those remote checks are unnecessary for routine work. The only permitted GitHub
interaction is an ordinary `git push` after local verification and commit.

Before pushing, verify locally that `.github/workflows/` has no added or modified
workflow files. After pushing, do not query Actions, Pages, workflow runs, or any
other GitHub API endpoint.

The hard guard in `claude-hooks/pre-tool-use.sh` enforces this policy. If a
future request appears to require GitHub CI or Pages, stop and ask the user to
explicitly reverse this standing policy before changing the guard.

## Artifact template work: completion is evidence, not a promise

For every change under `apps/frontend-vite/src/components/artifact/templates/` or
`apps/frontend-vite/src/components/artifact/pdf-templates/`, follow the complete
one-pass rules injected by `claude-hooks/user-prompt-search.sh` and
`claude-hooks/pre-tool-use.sh`. The rules below are additional hard gates.

1. **Lock the target before editing.** Record the tracker row and prompt, Mongo
   collection, JSX component, PDF component, and exact real-record reference.
   Before resolving that lock, verify the immediately prior completed tracker row
   has A:D solid `#00B0F0` by values/styles readback. If that evidence is missing,
   stop on the prior row and do not inspect, lock, or edit the next template. If
   the user changes the target, discard the old lock and resolve all six again.
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
   gate succeeds, and never begin the next tracker row until this readback succeeds.
8. **Always include the testing identity in the final report.** Every completed
   template report must state the template name, patient name, medical collection,
   and the exact test line in the form `Show me <Patient Name> <Template Name>`.
   Never omit the test line when handing a template back for user review.

Browser control is discovered per agent surface and session. A Chrome extension
or a browser connection in the ChatGPT app does not prove that terminal Codex has
the same connection; check the available capability before promising browser QA.

Never send patient-associated values, credentials, source code, or private paths
to memory/session tools. IntelliCare session state remains local-only.
