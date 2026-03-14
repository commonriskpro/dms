import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import "../styles/theme.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "600", "700", "800"],
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
      <body className={`${fontSans.variable} font-sans`}>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
