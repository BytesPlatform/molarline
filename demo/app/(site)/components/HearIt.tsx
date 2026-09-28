"use client";

/**
 * The recorded calls. One audio element per recording, a progress bar, and
 * a transcript that opens under the player. Only one plays at a time.
 */

import { useEffect, useRef, useState } from "react";
import type { Recording } from "@/lib/recordings";

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function Player({ rec, active, onPlay }: { rec: Recording; active: boolean; onPlay: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(rec.seconds);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active && playing) {
      audio.current?.pause();
    }
  }, [active, playing]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      onPlay();
      void a.play();
    } else {
      a.pause();
    }
  };

  return (
    <article className="s-rec">
      <div className="s-rec-top">
        <button type="button" className="s-play" onClick={toggle} aria-label={playing ? `Pause ${rec.title}` : `Play ${rec.title}`}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" />
            </svg>
          )}
        </button>
        <div className="s-rec-meta">
          <span className="s-rec-title">{rec.title}</span>
          <span className="s-rec-scene">{rec.scene}</span>
        </div>
        <span className="s-rec-time">
          {mmss(t)} / {mmss(dur)}
        </span>
      </div>
      <div className="s-bar" aria-hidden="true">
        <div className="s-bar-fill" style={{ width: `${dur ? (t / dur) * 100 : 0}%` }} />
      </div>
      <div className="s-rec-actions">
        <button type="button" className="s-linkbtn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide transcript" : "Read the transcript"}
        </button>
      </div>
      {open ? (
        <div className="s-transcript">
          {rec.transcript.map((line, i) => (
            <div key={i} className="s-transcript-line">
              <span className="s-transcript-who">{line.who === "agent" ? "Assistant" : "Caller"}</span>
              <span>{line.text}</span>
            </div>
          ))}
        </div>
      ) : null}
      <audio
        ref={audio}
        src={rec.file}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setT(0);
        }}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || rec.seconds)}
      />
    </article>
  );
}

export default function HearIt({ recordings }: { recordings: Recording[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="s-recordings">
      {recordings.map((rec) => (
        <Player key={rec.id} rec={rec} active={active === rec.id} onPlay={() => setActive(rec.id)} />
      ))}
    </div>
  );
}
