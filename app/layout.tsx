import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "ClassTrace — See how your class is thinking", template: "%s · ClassTrace" },
  description: "Misconception intelligence that reveals student reasoning and turns it into targeted classroom action.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "ClassTrace — See how your class is thinking",
    description: "Trace student reasoning, discover shared misconceptions, and verify what changed.",
    type: "website",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "ClassTrace reasoning paths branching from one student response" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
