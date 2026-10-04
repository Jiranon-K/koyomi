import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { actionProblems, isActionFile } from "./guard-check";

const SRC_DIR = join(import.meta.dirname, "..", "..");

const files = readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })
  .filter(
    (file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file) && !/\.test\.(ts|tsx|js|jsx|mjs)$/.test(file),
  )
  .map((file) => ({
    file: `src/${file.replaceAll("\\", "/")}`,
    source: readFileSync(join(SRC_DIR, file), "utf8"),
  }));

const actionFiles = files.filter((file) => isActionFile(file.source));

describe("isActionFile", () => {
  it("recognises the directive as the first statement, with either quote", () => {
    expect(isActionFile('"use server";\n\nexport async function a() {}')).toBe(true);
    expect(isActionFile("'use server'\nexport async function a() {}")).toBe(true);
    expect(isActionFile('// actions\n"use server";\nexport async function a() {}')).toBe(true);
  });

  it("ignores a file that only mentions the directive", () => {
    expect(isActionFile('import "x";\n"use server";')).toBe(false);
    expect(isActionFile("// use server\nexport const a = 1;")).toBe(false);
  });
});

describe("actionProblems", () => {
  const header = '"use server";\nimport { requireSession, requireAdmin } from "./session";\n';

  it.each([
    ["requireSession", "await requireSession();"],
    ["requireAdmin", "await requireAdmin();"],
    ["a destructured result", "const { user } = await requireSession();"],
    ["a plain result", "const session = await requireAdmin();"],
  ])("accepts an action that starts with %s", (_name, guard) => {
    const source = `${header}export async function doIt(): Promise<void> {\n  ${guard}\n  work();\n}`;

    expect(actionProblems(source)).toEqual([]);
  });

  it("reads a multi-line signature and a return type with braces", () => {
    const source = `${header}export async function doIt(
  _previous: State,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { user } = await requireSession();
  return { error: user.id };
}`;

    expect(actionProblems(source)).toEqual([]);
  });

  it("names an action with no guard, even when the file imports one", () => {
    const source = `${header}export async function doIt() {\n  work();\n}`;

    expect(actionProblems(source)).toEqual([expect.stringContaining("doIt")]);
  });

  it("rejects a guard that comes after other work", () => {
    const source = `${header}export async function doIt(formData: FormData) {\n  parse(formData);\n  await requireSession();\n}`;

    expect(actionProblems(source)).toEqual([expect.stringContaining("doIt")]);
  });

  it("rejects a guard that is only commented out", () => {
    const source = `${header}export async function doIt() {\n  // await requireSession();\n  /* await requireAdmin(); */\n  work();\n}`;

    expect(actionProblems(source)).toEqual([expect.stringContaining("doIt")]);
  });

  it("rejects an action that reaches its guard through a helper", () => {
    const source = `${header}async function helper() {\n  await requireSession();\n}\nexport async function doIt() {\n  await helper();\n}`;

    expect(actionProblems(source)).toEqual([expect.stringContaining("doIt")]);
  });

  it("accepts a guarded action with a // inside a string in its signature", () => {
    const source = `${header}export async function doIt(url = "http://x") {\n  await requireSession();\n}`;

    expect(actionProblems(source)).toEqual([]);
  });

  it("accepts a guarded action whose return type holds an arrow function with a body", () => {
    const source = `${header}export async function doIt(): Promise<{ f: () => { x: 1 } }> {\n  await requireSession();\n}`;

    expect(actionProblems(source)).toEqual([]);
  });

  it("does not borrow the body of the next function for a signature with no body", () => {
    const source = `${header}export async function doIt(x: string): Promise<void>;\nexport async function doIt(x: string | number): Promise<void> {\n  await requireSession();\n}`;

    expect(actionProblems(source)).toEqual([expect.stringContaining("doIt")]);
  });

  it("names only the unguarded action when others are fine", () => {
    const source = `${header}export async function good() {\n  await requireSession();\n}\nexport async function bad() {\n  work();\n}`;

    expect(actionProblems(source)).toEqual([expect.stringContaining("bad")]);
  });

  it.each([
    ["an arrow function", "export const doIt = async () => {\n  await requireSession();\n};"],
    ["a default export", "export default async function () {\n  await requireSession();\n}"],
    ["a re-export", 'export { other } from "./other";'],
    ["a synchronous function", "export function doIt() {\n  await requireSession();\n}"],
  ])("refuses %s because it cannot read it", (_name, code) => {
    expect(actionProblems(`${header}${code}`)).toEqual([expect.stringContaining("unsupported")]);
  });

  it("allows exported types, which are erased", () => {
    const source = `${header}export type State = { error: string | null };\nexport async function doIt() {\n  await requireSession();\n}`;

    expect(actionProblems(source)).toEqual([]);
  });

  it("refuses an inline directive inside a function of an ordinary file", () => {
    const source =
      'export function page() {\n  async function act() {\n    "use server";\n    work();\n  }\n}';

    expect(isActionFile(source)).toBe(false);
    expect(actionProblems(source)).toEqual([expect.stringContaining("unsupported")]);
  });

  it("refuses an inline directive on one line", () => {
    const source =
      'export function page() {\n  const act = async () => { "use server"; work(); };\n}';

    expect(actionProblems(source)).toEqual([expect.stringContaining("unsupported")]);
  });

  it("finds nothing to say about an ordinary file", () => {
    expect(actionProblems("export function page() { return null; }")).toEqual([]);
  });
});

describe("server actions", () => {
  it("finds the action files, each with at least one action", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(4);
    for (const { file, source } of actionFiles) {
      expect(source, file).toMatch(/^export async function \w+/m);
    }
  });

  it("every exported action starts with await requireSession or requireAdmin", () => {
    const problems = files.flatMap(({ file, source }) =>
      actionProblems(source).map((problem) => `${file}: ${problem}`),
    );

    expect(problems).toEqual([]);
  });
});
