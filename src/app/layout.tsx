import type { Metadata } from "next";
import { Google_Sans_Code, Google_Sans_Flex, Instrument_Serif } from "next/font/google";

import { ThemeProvider } from "next-themes";

import { BRAND } from "@/components/brand";
import { MotionProvider } from "@/components/motion/motion-provider";
import "./globals.css";

const sans = Google_Sans_Flex({
  variable: "--font-google-sans-flex",
  subsets: ["latin"],
});

const mono = Google_Sans_Code({
  variable: "--font-google-sans-code",
  subsets: ["latin"],
});

const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.support,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
