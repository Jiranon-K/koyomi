import Link from "next/link";

// The top strip of every page: the wordmark on the left, page actions on the right.
export function Masthead({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-foreground px-6 py-3 label-mono sm:px-10">
      <Link href="/" className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Full-stack template
      </Link>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
