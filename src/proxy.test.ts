import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { config } from "./proxy";

const APP_DIR = join(import.meta.dirname, "app");

function isGuarded(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return /\bawait require(Session|Admin)\(/.test(code);
}

function routeOf(pageFile: string): string {
  const segments = pageFile
    .split("/")
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`;
}

function protectedPrefixes(matcher: readonly string[]): string[] {
  return matcher.map((pattern) => {
    const prefix = /^((?:\/[\w-]+)+)\/:path\*$/.exec(pattern)?.[1];
    if (!prefix) throw new Error(`This check cannot read the matcher pattern ${pattern}`);
    return prefix;
  });
}

function isProtected(route: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

const prefixes = protectedPrefixes(config.matcher);
const pages = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => /(^|\/)page\.(tsx|ts|jsx|js)$/.test(file))
  .map((file) => ({
    file: `src/app/${file}`,
    protected: isProtected(routeOf(file), prefixes),
    guarded: isGuarded(readFileSync(join(APP_DIR, file), "utf8")),
  }));

describe("isGuarded", () => {
  it.each(["requireSession", "requireAdmin"])("accepts a page that awaits %s", (guard) => {
    expect(isGuarded(`const { user } = await ${guard}();`)).toBe(true);
  });

  it("rejects a page with no guard", () => {
    expect(isGuarded("export default function Page() { return null; }")).toBe(false);
  });

  it("rejects a page whose guard is commented out", () => {
    expect(isGuarded("// const session = await requireSession();")).toBe(false);
    expect(isGuarded("/* await requireAdmin(); */")).toBe(false);
  });

  it("rejects a page that imports a guard without calling it", () => {
    expect(isGuarded('import { requireSession } from "@/features/auth/session";')).toBe(false);
  });
});

describe("protectedPrefixes", () => {
  it("refuses a matcher pattern it cannot turn into a path prefix", () => {
    expect(() => protectedPrefixes(["/(dashboard|admin)/:path*"])).toThrow(/cannot read/);
    expect(() => protectedPrefixes(["/dashboard"])).toThrow(/cannot read/);
  });
});

describe("routeOf", () => {
  it("drops the page file and route-group folders", () => {
    expect(routeOf("(auth)/(split)/sign-in/page.tsx")).toBe("/sign-in");
    expect(routeOf("dashboard/settings/page.tsx")).toBe("/dashboard/settings");
    expect(routeOf("page.tsx")).toBe("/");
  });
});

describe("isProtected", () => {
  it("covers a prefix and everything below it, but not a sibling with the same start", () => {
    const dashboard = protectedPrefixes(["/dashboard/:path*"]);

    expect(isProtected("/dashboard", dashboard)).toBe(true);
    expect(isProtected("/dashboard/settings", dashboard)).toBe(true);
    expect(isProtected("/dashboard-preview", dashboard)).toBe(false);
  });
});

describe("private pages", () => {
  it("finds the pages and at least one protected path", () => {
    expect(prefixes.length).toBeGreaterThan(0);
    expect(pages.some((page) => page.protected)).toBe(true);
  });

  it("every page under a path the proxy protects awaits requireSession or requireAdmin", () => {
    const unguarded = pages.filter((page) => page.protected && !page.guarded);

    expect(unguarded.map((page) => page.file)).toEqual([]);
  });

  it("every page that awaits a guard is under a path the proxy protects", () => {
    const uncovered = pages.filter((page) => page.guarded && !page.protected);

    expect(uncovered.map((page) => page.file)).toEqual([]);
  });
});
