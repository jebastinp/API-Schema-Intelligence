import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Schema Studio",
  description: "Project foundation for the Schema Studio platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const storedTheme = localStorage.getItem("schema-studio-theme");
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const theme = storedTheme ?? (prefersDark ? "dark" : "light");
              if (theme === "dark") {
                document.documentElement.classList.add("dark");
              } else {
                document.documentElement.classList.remove("dark");
              }
            } catch (_) {}
          })();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
