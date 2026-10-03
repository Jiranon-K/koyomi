import { Masthead } from "@/components/masthead";
import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <ThemeToggle />
      </Masthead>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <Reveal>{children}</Reveal>
      </main>
    </div>
  );
}
