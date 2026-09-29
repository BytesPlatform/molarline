"use client";

/**
 * Step 7: call your own assistant from the browser. The checklist ticks
 * itself from the pipeline steps the call produces, and the ticks are saved
 * so the go-live page can show them.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import CallPanel from "@/app/components/CallPanel";
import { useDemoState } from "@/app/hooks/useDemoState";
import { useRetellCall } from "@/app/hooks/useRetellCall";
import { saveChecklistAction } from "./actions";

const CHECKS: { key: string; label: string; steps: string[] }[] = [
  { key: "verified", label: "It answered with your greeting and the connection was verified", steps: ["signature_verified"] },
  { key: "patient", label: "It identified the patient by name and date of birth, or set one up", steps: ["patient_matched"] },
  { key: "slots", label: "It offered open times with the right provider at the right office", steps: ["slots_checked"] },
  { key: "booked", label: "It booked the appointment", steps: ["appointment_written"] },
  { key: "audit", label: "It wrote the access to the audit log", steps: ["audit_logged"] },
  { key: "consent", label: "It recorded the recording notice and any text consent", steps: ["consent_recorded"] },
  { key: "reminder", label: "It queued the confirmation text", steps: ["reminder_queued"] },
];

export default function TestCall({ companyName, saved }: { companyName: string; saved: Record<string, boolean> }) {
  const call = useRetellCall(companyName, "app");
  const { state } = useDemoState("", 0, "app");
  const [ticks, setTicks] = useState<Record<string, boolean>>(saved);
  const lastSaved = useRef("");

  const done = useMemo(() => {
    const out: Record<string, boolean> = { ...ticks };
    if (call.callId) {
      const steps = new Set(state.pipeline.filter((r) => r.call_id === call.callId && (r.status === "ok" || r.status === "warn")).map((r) => r.step));
      for (const c of CHECKS) if (c.steps.some((s) => steps.has(s))) out[c.key] = true;
    }
    return out;
  }, [ticks, call.callId, state.pipeline]);

  useEffect(() => {
    if (!call.callId) return;
    const key = JSON.stringify(done);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    setTicks(done);
    void saveChecklistAction(call.callId, done);
  }, [done, call.callId]);

  const count = CHECKS.filter((c) => done[c.key]).length;

  return (
    <div className="setup-test">
      <div className="setup-test-call">
        <CallPanel
          phase={call.phase}
          isLive={call.isLive}
          configured={call.config?.retell.configured ?? false}
          scope="app"
          callId={call.callId}
          startedAt={call.startedAt}
          agentTalking={call.agentTalking}
          ringing={call.ringing}
          muted={call.muted}
          turns={call.turns}
          storedTurns={null}
          showingStored={false}
          redactionCount={0}
          phoneNumber={call.config?.retell.phoneNumber ?? ""}
          practiceName={companyName}
          locationName={companyName}
          error={call.error}
          endedReason={call.endedReason}
          flaggedSummary={null}
          onStart={() => void call.start()}
          onEnd={() => void call.end()}
          onToggleMute={call.toggleMute}
        />
      </div>
      <div className="admin-section">
        <h2 className="admin-title-sm">
          Checklist, {count} of {CHECKS.length}
        </h2>
        <p className="admin-help">
          Press Call and speak the way a patient would: "I'd like to book a cleaning", then give a name and date of birth. For a new patient, say so and give your details. Each line ticks as the assistant does it.
        </p>
        <ul className="setup-checklist">
          {CHECKS.map((c) => (
            <li key={c.key} className={done[c.key] ? "is-done" : ""}>
              <span className="setup-tick" aria-hidden="true">
                {done[c.key] ? "✓" : ""}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        <p className="admin-sub">Nothing from a test call is real: the appointment lands on your schedule marked as made by the assistant, and you can cancel it.</p>
      </div>
    </div>
  );
}
