import { readFileSync } from "node:fs";

import { branchProblem, messageProblem, titleProblem } from "./git-conventions";

const print = (line: string) => process.stderr.write(`${line}\n`);

const [kind, value] = process.argv.slice(2);

function problemOf(): { subject: string; problem: string | null } | undefined {
  if (value === undefined) return undefined;
  if (kind === "branch") return { subject: value, problem: branchProblem(value) };
  if (kind === "title") return { subject: value, problem: titleProblem(value) };
  if (kind === "message-file") {
    const message = readFileSync(value, "utf8");
    return { subject: message.split(/\r?\n/, 1)[0] ?? "", problem: messageProblem(message) };
  }
  return undefined;
}

const checked = problemOf();
if (!checked) {
  print("Usage: bun scripts/check-git-conventions.ts <branch|title|message-file> <value>");
  process.exit(2);
}

if (checked.problem) {
  print(
    `${kind === "branch" ? "Branch name" : "Commit or pull request title"} refused: "${checked.subject}"`,
  );
  print(checked.problem);
  print("See CONTRIBUTING.md.");
  process.exit(1);
}
