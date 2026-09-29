/**
 * The live demo, behind sign-in (proxy.ts): a signed-in customer or admin
 * can call the demo agent and reset it. The product itself lives at /app.
 */
import type { Metadata } from "next";
import Desk from "@/app/components/Desk";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Live demo | ${PRODUCT.name}`,
  description: `Call the ${PRODUCT.name} assistant from your browser and watch every step it takes on a live dashboard.`,
  robots: { index: false },
};

export default function DemoPage() {
  return <Desk scope="demo" canReset />;
}
