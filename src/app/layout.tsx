import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Use Inter from Google Fonts instead of missing local fonts
import "./globals.css";

// Use Inter font from Google Fonts
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Podcast Generator",
  description: "Generate podcast audio from your scripts with AI voices",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}