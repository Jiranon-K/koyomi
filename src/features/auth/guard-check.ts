// Text checks behind the tests that every private page and every Server Action calls a guard.
// They read source, not behaviour: they catch a forgotten guard, not a guard that misbehaves.

const GUARD_CALL = /\bawait require(Session|Admin)\(/;
const GUARD_FIRST = /^(?:(?:const|let)\s+[^=;]+=\s*)?await require(?:Session|Admin)\(\s*\)\s*;/;
const FILE_DIRECTIVE = /^\s*["']use server["']/;
const INLINE_DIRECTIVE = /\{\s*["']use server["']/;
const ASYNC_FUNCTION = /^export\s+async\s+function\s+(\w+)\s*\(/;
// A string (kept, group 1) or a comment (dropped), so a `//` inside a string is not a comment.
const STRING_OR_COMMENT =
  /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/.*$/gm;

function stripComments(source: string): string {
  return source.replace(STRING_OR_COMMENT, (_match, kept: string | undefined) => kept ?? "");
}

export function isGuarded(source: string): boolean {
  return GUARD_CALL.test(stripComments(source));
}

export function isActionFile(source: string): boolean {
  return FILE_DIRECTIVE.test(stripComments(source));
}

// The text after the `{` that opens a function body, given the index just after its `(`.
function bodyAfter(code: string, afterOpenParen: number): string | undefined {
  let depth = 1;
  let i = afterOpenParen;
  for (; i < code.length && depth > 0; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")") depth--;
  }

  // Angle brackets only matter for braces in a return type such as Promise<{ ... }>; the `>` of an
  // arrow inside it is not a closing bracket. A `;` first means a signature with no body.
  let angle = 0;
  for (; i < code.length; i++) {
    const char = code[i];
    if (char === "<") angle++;
    else if (char === ">" && code[i - 1] !== "=") angle--;
    else if (char === ";" && angle <= 0) return undefined;
    else if (char === "{" && angle <= 0) return code.slice(i + 1);
  }
  return undefined;
}

// What is wrong with the Server Actions in a source file, one sentence each. A file that is not
// a "use server" file has nothing to say unless it hides a directive this check cannot read.
export function actionProblems(source: string): string[] {
  const code = stripComments(source);

  if (!isActionFile(source)) {
    return INLINE_DIRECTIVE.test(code)
      ? ['unsupported: an inline "use server" directive; move the action to a "use server" file']
      : [];
  }

  const problems: string[] = [];
  for (const exported of code.matchAll(/^export\b[^\n]*/gm)) {
    const line = exported[0];
    if (/^export\s+(type|interface)\b/.test(line)) continue;

    const fn = ASYNC_FUNCTION.exec(code.slice(exported.index));
    const name = fn?.[1];
    if (!fn || !name) {
      problems.push(`unsupported export (${line.trim()}): only exported async functions are read`);
      continue;
    }

    const body = bodyAfter(code, exported.index + fn[0].length);
    if (body === undefined || !GUARD_FIRST.test(body.trimStart())) {
      problems.push(
        `${name}: the first statement must be await requireSession() or requireAdmin()`,
      );
    }
  }
  return problems;
}
