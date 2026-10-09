/* The one place that knows the branch, commit and pull request naming rules (CONTRIBUTING.md). */

export const TYPES = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "docs",
  "test",
  "style",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

export const PROTECTED_BRANCH = "main";

const MAX_HEADER = 100;
const types = TYPES.join("|");
const HEADER = new RegExp(`^(?:${types})(?:\\([a-z0-9][a-z0-9-]*\\))?!?: \\S.*$`);
const BRANCH = new RegExp(`^(?:${types})/[a-z0-9][a-z0-9.-]*$`);
/* Messages git writes itself: a merge of main into the branch, a revert, an autosquash commit. */
const GIT_WRITTEN = /^(?:Merge |Revert "|fixup! |squash! |amend! )/;

const FORMAT = `<type>(<optional scope>): <summary>, where type is one of ${TYPES.join(", ")}`;

/* The reason a pull request title is refused, or null when it is fine. */
export function titleProblem(title: string): string | null {
  if (title.includes("\n")) return "It must be a single line.";
  if (!HEADER.test(title)) return `It must read ${FORMAT}.`;
  if (title.length > MAX_HEADER) {
    return `It is ${title.length} characters; the limit is ${MAX_HEADER}.`;
  }
  if (title.endsWith(".")) return "It must not end with a full stop.";
  return null;
}

/* The same rule for a whole commit message: only its first line is checked. */
export function messageProblem(message: string): string | null {
  const header = message.split(/\r?\n/, 1)[0] ?? "";
  if (GIT_WRITTEN.test(header)) return null;
  return titleProblem(header);
}

export function branchProblem(branch: string): string | null {
  if (branch === PROTECTED_BRANCH) {
    return `${PROTECTED_BRANCH} only changes through a pull request; work on a branch.`;
  }
  if (branch.startsWith("dependabot/")) return null;
  if (!BRANCH.test(branch)) {
    return `It must read <type>/<short-kebab-case-topic>, where type is one of ${TYPES.join(", ")}.`;
  }
  return null;
}
