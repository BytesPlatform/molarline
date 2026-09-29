/**
 * What the dashboard shows before the first real call: believable rows
 * marked "Example", so a new practice sees what the screens will hold.
 * They disappear on the first real event. Product-specific copy.
 */

import type { CallRow, NeedsYouItem, StatCard, UpcomingVisit } from "./dash";
import { dayStartUtc } from "./dash";

export interface ExampleHome {
  stats: StatCard[];
  needsYou: NeedsYouItem[];
  todaysCalls: CallRow[];
  upcoming: UpcomingVisit[];
}

function at(base: Date, hours: number, minutes = 0): string {
  return new Date(base.getTime() + (hours * 60 + minutes) * 60_000).toISOString();
}

export function exampleHome(tz: string): ExampleHome {
  const today = dayStartUtc(tz);
  const call = (n: number, row: Partial<CallRow>): CallRow => ({
    call_id: `example_${n}`,
    flagged: false,
    started_at: at(today, 8),
    ended_at: null,
    channel: "phone",
    from_number: null,
    urgency: null,
    outcome: "completed",
    after_hours: false,
    booked: false,
    ticket_value: null,
    summary: null,
    has_transcript: false,
    has_recording: false,
    ...row,
  });
  return {
    stats: [
      { label: "Calls today", today: 16, yesterday: 13 },
      { label: "Appointments booked", today: 6, yesterday: 4 },
      { label: "Open requests", today: 2, yesterday: 3 },
    ],
    needsYou: [
      {
        kind: "queue",
        id: "ex_1",
        title: "Two cleanings, back to back",
        detail: "A mother asked for two children's cleanings together; no open pair of slots this week.",
        when: at(today, 9, 12),
        phone: null,
        canDone: false,
        callId: null,
      },
      {
        kind: "flagged",
        id: "ex_2",
        title: "A call was handed to staff",
        detail: "A caller asked about a crown that broke and billing for it; the assistant took a message for the front desk.",
        when: at(today, 8, 3),
        phone: null,
        canDone: false,
        callId: null,
      },
    ],
    todaysCalls: [
      call(1, {
        started_at: at(today, 12, 41),
        booked: true,
        summary: "Cleaning booked over the lunch hour for a returning patient, confirmation texted.",
      }),
      call(2, {
        started_at: at(today, 9, 41),
        booked: true,
        summary: "New patient exam booked; patient set up with name and date of birth.",
      }),
      call(3, {
        started_at: at(today, 11, 26),
        flagged: true,
        summary: "Billing question about an insurance claim; handed to staff with the call summarised.",
      }),
    ],
    upcoming: [
      {
        id: "ex_v1",
        title: "Cleaning",
        starts_at: at(today, 32),
        ends_at: at(today, 32, 40),
        client_name: "Sofia R.",
        worker_name: "Dr. Patel",
        urgency: "routine",
        by_agent: true,
      },
      {
        id: "ex_v2",
        title: "New patient exam",
        starts_at: at(today, 34),
        ends_at: at(today, 35),
        client_name: "Marcus D.",
        worker_name: "Dr. Kim",
        urgency: "quote",
        by_agent: true,
      },
    ],
  };
}
