import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const SITE_URL = "https://dental-ai-receptionist-eta.vercel.app";
const TITLE = "AI Dental Receptionist | HIPAA-Aware, Books 24/7";
const DESCRIPTION =
  "AI dental receptionist that answers every call, books cleanings into your schedule and logs every step for HIPAA. Try the live demo.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "MolarLine",
  keywords: [
    "AI dental receptionist",
    "dental phone answering",
    "HIPAA compliant AI receptionist",
    "dental appointment booking AI",
    "after hours dental answering service",
    "Retell AI dental",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "MolarLine",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AI dental receptionist demo: the call, the schedule and the compliance trail" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0812" },
  ],
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MolarLine",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "149", priceCurrency: "USD", description: "Starter plan, monthly" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Clerk wraps the tree only when its keys exist, so the public demo still
  // builds and deploys before the Clerk application is created.
  const body = clerkConfigured ? <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider> : children;
  return (
    <html lang="en">
      <head>
        {/*
          Fonts are linked rather than bundled so a build never depends on
          network access, and every family has a real fallback stack in
          globals.css if the link does not resolve on the demo machine.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body>{body}</body>
    </html>
  );
}
