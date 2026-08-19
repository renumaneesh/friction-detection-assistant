import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Friction Radar — AI Customer Journey Dashboard",
  description:
    "Real-time detection and recovery assistant for at-risk customer sessions. Powered by Gemini AI.",
  keywords: ["customer journey", "friction detection", "ecommerce", "AI", "dashboard"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
