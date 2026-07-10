import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
