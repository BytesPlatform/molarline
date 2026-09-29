/**
 * The live demo, for invited customers and our team: proxy.ts asks for a
 * session, and this page asks for a membership or a platform admin on top,
 * so an account someone created by itself unlocks nothing. The product
 * lives at /app.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Desk from "@/app/components/Desk";
import { demoAccess, getSession } from "@/lib/auth";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Live demo | ${PRODUCT.name}`,
  description: `Call the ${PRODUCT.name} assistant from your browser and watch every step it takes on a live dashboard.`,
  robots: { index: false },
};

export default async function DemoPage() {
  if (!(await demoAccess())) redirect((await getSession()) ? "/app/no-workspace" : "/sign-in");
  return <Desk scope="demo" canReset />;
}
