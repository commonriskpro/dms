import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import "../styles/theme.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
import { Providers } from "./providers";
import { getThemeInitScript } from "@/lib/ui/theme/theme-init-script";

export const metadata: Metadata = {
  title: "DMS",
  description: "Dealer Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
