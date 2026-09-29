"use client";

/** The day grid, live, with the office picker and the day picker. */

import { useState } from "react";
import DayPicker from "@/app/components/DayPicker";
import SchedulePanel from "@/app/components/SchedulePanel";
import { useDemoState } from "@/app/hooks/useDemoState";

export default function ScheduleClient() {
  const [dayOffset, setDayOffset] = useState(0);
  const [locationId, setLocationId] = useState("");
  const { state } = useDemoState(locationId, dayOffset, "app");
  const locations = state.grid?.locations ?? [];
  return (
    <section className="panel dash-board">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">Schedule</h2>
          <p className="panel-sub">The assistant's bookings carry an AI badge</p>
        </div>
        <div className="panel-head-end">
          {locations.length > 1 ? (
            <select
              className="dash-select"
              value={locationId || state.grid?.locationId || ""}
              onChange={(e) => setLocationId(e.target.value)}
              aria-label="Office"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          <DayPicker dayOffset={dayOffset} onChange={setDayOffset} />
        </div>
      </header>
      <div className="panel-body">
        <SchedulePanel grid={state.grid} appointments={state.appointments} dayOffset={dayOffset} loaded={state.loaded} />
      </div>
    </section>
  );
}
