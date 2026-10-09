# Contributing

`main` is always releasable and nobody commits to it directly. Every change goes
through a short-lived branch and a pull request (GitHub Flow), and lands on `main`
as one squashed commit named in the Conventional Commits format.

## The flow

1. Start from an up-to-date `main`:

   ```bash
   git switch main && git pull && git switch -c feat/month-view
   ```

2. Commit on the branch. Every commit message follows the format below.
3. Push the branch and open a pull request. Fill in the template.
4. CI must be green: `verify` (audit, `./verify.sh`, end-to-end tests) and
   `conventions` (branch name and pull request title).
5. Squash and merge. The pull request title becomes the commit on `main`, and
   GitHub deletes the branch.

## Branch names

`<type>/<short-kebab-case-topic>`, one topic per branch:

```text
feat/month-view
fix/digest-quota-month
docs/readme-setup
chore/update-next
```

The type is one from the table below. Lowercase letters, digits, `-` and `.` only.

## Commit messages and pull request titles

```text
<type>(<optional scope>): <summary>
```

- At most 100 characters, no full stop at the end.
- The summary starts with a lowercase verb in the imperative: `add`, `fix`, `remove`.
- The scope is the feature folder or area: `auth`, `schedule`, `follows`, `line`,
  `notifications`, `admin`, `preferences`, `design`, `motion`, `e2e`, `readme`.
- Add `!` before the colon for a breaking change: `feat(auth)!: drop password sign-in`.
- A ticket reference goes at the end: `feat(admin): add the status page (koyomi 07)`.

| Type       | Use it for                                              |
| ---------- | ------------------------------------------------------- |
| `feat`     | New behaviour a user or operator can see                |
| `fix`      | A bug fix                                               |
| `refactor` | A code change with no behaviour change                  |
| `perf`     | A change that only makes something faster               |
| `docs`     | Documentation only                                      |
| `test`     | Tests only                                              |
| `style`    | Formatting only (Prettier); not visual design           |
| `build`    | Dependencies and the build system                       |
| `ci`       | The CI workflow and Dependabot                          |
| `chore`    | Tooling, hooks, scripts and other maintenance           |
| `revert`   | Reverting an earlier commit                             |

## What enforces it

| Rule                                   | Where                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| No commit on `main`                    | `.githooks/pre-commit`                                       |
| Commit message format                  | `.githooks/commit-msg`                                       |
| Branch name, no push to `main`         | `.githooks/pre-push`                                         |
| Branch name and pull request title     | `.github/workflows/pr.yml` (`conventions`)                   |
| Pull request required, checks required | Branch protection on `main`, applied to administrators too   |
| Squash merge only                      | Repository settings                                          |

The rules themselves live in one place, `scripts/git-conventions.ts`.

## Reading the history

```bash
git log --first-parent --oneline main
```

shows one line per change. The work before 2026-10-10 was committed directly to
`main`; it was regrouped that day into one merge per feature, with file contents
unchanged.
