import { cn } from "cn";

type LineLoginButtonProps = Omit<React.ComponentProps<"button">, "children" | "disabled"> & {
  pending: boolean;
};

export function LineLoginButton({ pending, className, ...props }: LineLoginButtonProps) {
  return (
    <button
      type="button"
      {...props}
      data-line-login
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "group flex h-11 w-full bg-line-button text-base leading-none font-bold text-line-button-foreground outline-none hover:bg-line-button-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-line-button-press disabled:pointer-events-none disabled:bg-line-button-disabled disabled:text-line-button-disabled-foreground disabled:inset-ring disabled:inset-ring-line-button-disabled-rule",
        className,
      )}
    >
      <span data-line-icon aria-hidden="true" className="size-11 shrink-0 line-login-icon" />
      <span
        data-line-label
        className="flex flex-1 items-center justify-center border-l border-line-button-rule px-8 whitespace-nowrap group-disabled:border-line-button-disabled-rule"
      >
        Log in with LINE
      </span>
    </button>
  );
}
