import { StaggerItem } from "@/components/motion/stagger";

export function StatusRow({
  label,
  state,
  failed = false,
  children,
}: {
  label: string;
  state: string;
  failed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <StaggerItem className="grid gap-x-4 gap-y-3 border-b border-border py-5 sm:grid-cols-[7rem_1fr]">
      <dt className="pt-1.5 label-mono text-muted-foreground">{label}</dt>
      <dd className="grid gap-3">
        <p className={failed ? "text-lg leading-snug text-destructive" : "text-lg leading-snug"}>
          {state}
        </p>
        {children}
      </dd>
    </StaggerItem>
  );
}

export function StatusNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
