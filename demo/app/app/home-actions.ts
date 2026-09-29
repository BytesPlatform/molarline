"use server";

/** "Done" on a Needs-you row. The kinds are this product's (see lib/dash). */

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { markNeedsDone } from "@/lib/dash";

export async function needsDoneAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const kind = String(form.get("kind") ?? "");
  const id = String(form.get("id") ?? "");
  if (kind && id && !id.startsWith("ex_")) await markNeedsDone(ctx.tenant.id, kind, id);
  revalidatePath("/app");
}
