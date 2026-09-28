/**
 * Route protection. /app and /admin need a Clerk session; everything else,
 * including the public demo at / and the Retell webhooks, stays open.
 *
 * Without Clerk keys the proxy does nothing and the product pages guard
 * themselves (see lib/auth.ts), so the public demo keeps deploying before
 * the Clerk application exists.
 */

import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

/** The addresses this product used to live at. Anyone arriving there is sent to the current one, path intact. */
const LEGACY_HOSTS: Record<string, string> = {
  "dental-ai-receptionist-eta.vercel.app": "https://molarline.vercel.app",
};

const isProtected = (request: NextRequest) => /^\/(app|admin)(\/|$)/.test(request.nextUrl.pathname);

const withClerk = clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) await auth.protect();
});

export default function proxy(request: NextRequest, event: Parameters<typeof withClerk>[1]) {
  const host = request.headers.get("host") ?? "";
  if (LEGACY_HOSTS[host]) return NextResponse.redirect(`${LEGACY_HOSTS[host]}${request.nextUrl.pathname}${request.nextUrl.search}`, 308);
  if (!configured) return NextResponse.next();
  return withClerk(request, event);
}

export const config = {
  matcher: [
    // Everything except static files and Next internals.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
