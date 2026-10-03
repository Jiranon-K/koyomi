# Issue tracker: Local Markdown

Specs and issues for this repo live as markdown files on disk. Both locations are listed in `.git/info/exclude`, so they are local-only and have no git history.

## Conventions

- One feature per slug: `<feature-slug>` (for example `better-auth`)
- The spec is `docs/specs/<feature-slug>.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Each issue links its spec on the first line under the title: ``Spec: `docs/specs/<feature-slug>.md` ``
- Triage state is recorded as a `**Status:**` line near the top of each issue file (see `triage-labels.md` for the role strings). Work state uses the same line: `in progress`, `done`
- Blocking is recorded as a `**Blocked by:**` line naming ticket numbers
- Acceptance criteria are a checkbox list. A ticket is `done` only when every box is ticked and the verify result is recorded in the file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/issues/` (creating the directory if needed). Publish a spec to `docs/specs/<feature-slug>.md`.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
