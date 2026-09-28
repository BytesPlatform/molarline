/**
 * The "Hear it" recordings on the landing site. Synthetic for now (two neural
 * voices, caller side band-limited like a phone line); replaced with real
 * calls to the product's own agent once phone numbers exist.
 */

export interface RecordingLine {
  who: "agent" | "caller";
  text: string;
}

export interface Recording {
  id: string;
  title: string;
  scene: string;
  file: string;
  seconds: number;
  transcript: RecordingLine[];
}

export const RECORDINGS: Recording[] = [
  {
    id: "book-cleaning",
    title: "A cleaning, booked over lunch",
    scene: "An existing patient calls while the desk is at lunch. Found by name and date of birth, offered two real openings, booked in thirty-four seconds.",
    file: "/audio/dental-book-cleaning.mp3",
    seconds: 34,
    transcript: [
      { who: "agent", text: "Thank you for calling Riverside Family Dental. How can I help?" },
      { who: "caller", text: "Hi, I'd like to book a cleaning." },
      { who: "agent", text: "Happy to. Your name and date of birth, please?" },
      { who: "caller", text: "Priya Raman, February eighth, nineteen ninety-two." },
      { who: "agent", text: "Found you, Priya. I have Tuesday at ten, or Thursday at two thirty with Ms. Hayes, Downtown." },
      { who: "caller", text: "Thursday at two thirty." },
      { who: "agent", text: "You're booked. I'll text you a confirmation. See you Thursday, Priya." },
    ],
  },
];
