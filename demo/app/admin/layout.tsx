/**
 * The internal console. Platform team only; everyone else is sent to /app.
 */
import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = { title: "Admin console", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformAdmin();
  return (
    <div className="admin">
      <header className="admin-bar">
        <a className="admin-brand" href="/admin">
          {PRODUCT.name} admin
        </a>
        <nav className="admin-nav">
          <a href="/admin">Customers</a>
          <a href="/admin/usage">Usage</a>
          <a href="/admin/leads">Demo requests</a>
          <a href="/app">Open a workspace</a>
          <a href="/demo">Live demo</a>
          <a href="/">Site</a>
        </nav>
        <span className="admin-who">{session.email}</span>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
