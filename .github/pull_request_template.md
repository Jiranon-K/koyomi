<!--
Title: <type>(<scope>): <summary>, for example "feat(schedule): add a month view".
The title becomes the commit on main when the pull request is squashed.
-->

## Summary

<!-- What changes for the user or the codebase, and why. Two or three sentences. -->

## Type

<!-- Keep the one that matches the title; delete the rest. -->

- `feat` — new behaviour
- `fix` — bug fix
- `refactor` / `perf` — no behaviour change
- `docs` / `test` / `style` — documentation, tests or formatting only
- `build` / `ci` / `chore` — dependencies, pipeline or tooling

## Changes

<!-- The main points, one line each. Name the ticket if there is one (for example "koyomi 07"). -->

-

## Verification

<!-- The commands that ran and their results. "Not run" with a reason is an acceptable answer. -->

| Command           | Result |
| ----------------- | ------ |
| `./verify.sh`     |        |
| `bun run e2e`     |        |
| Browser check     |        |

## Screenshots

<!-- UI changes only: before and after, light and dark. Delete this section otherwise. -->

## Checklist

- [ ] One topic only; unrelated changes are in their own pull request
- [ ] Tests cover the change, and no test or gate was removed or weakened
- [ ] `CLAUDE.md` and `.env.example` are updated if a convention or variable changed
- [ ] No secrets, env files or personal data in the diff
