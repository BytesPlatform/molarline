/** Schedule: the day board, one lane per technician. */
import Shell from "@/app/components/dash/Shell";
import { accountOf, requireDashboard } from "../shared";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const ctx = await requireDashboard();
  return (
    <Shell active="schedule" account={accountOf(ctx)}>
      <ScheduleClient />
    </Shell>
  );
}
