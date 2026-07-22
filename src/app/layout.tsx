import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Site-wide interface typeface (Visual Pass sub-slice 1): a restrained
// weight set covers body copy through headings without needing extreme
// weights anywhere. display: "swap" avoids invisible text while the font
// loads; the CSS variable is bound once here and consumed by
// globals.css's own font-family declaration, so every page (public and
// admin — there is only one root layout) inherits it identically.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PokeForce Companion",
  description: "A crafting wiki companion for PokeForce.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
