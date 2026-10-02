import type { Metadata } from "next";
import { Google_Sans_Code, Google_Sans_Flex } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Google_Sans_Flex({
  variable: "--font-google-sans-flex",
  subsets: ["latin"],
});

const mono = Google_Sans_Code({
  variable: "--font-google-sans-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next.js Full-Stack Template",
  description: "Next.js, shadcn/ui and MongoDB starter template.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
