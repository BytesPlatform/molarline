/**
 * The product, as opposed to the customer. PRACTICE in config.ts is the
 * practice the demo agent answers for; this is what we sell and every word
 * the landing site and the emails use. The site pages and the email
 * templates are shared across the three products verbatim; this file and
 * lib/recordings.ts are what differ.
 */

export interface Step {
  title: string;
  body: string;
}

export const PRODUCT = {
  name: "MolarLine",
  company: "Bytes Platform",
  headline: "Keep every chair full, without adding to the front desk",
  subhead:
    "An AI receptionist for dental practices. It answers every call, finds the patient, books cleanings and exams into open chair time at the right office, confirms by text, and hands anything clinical to your team. Built for HIPAA from the first line of code.",
  industry: "dental practices",
  buyer: "practices",
  worker: "provider",
  booking: "appointment",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://dental-ai-receptionist-eta.vercel.app",
  salesInbox: process.env.SALES_INBOX || "bytesuite@bytesplatform.com",
  fromEmail: process.env.SENDGRID_FROM_EMAIL || "hello@bytesplatform.com",
  fromName: process.env.SENDGRID_FROM_NAME || "MolarLine",
  consentText:
    "By submitting, you agree that MolarLine may call, text and email you about your inquiry, including with automated technology. Consent is not a condition of purchase. Reply STOP to any text to opt out.",

  proof: [
    { n: "24/7", label: "answers every call, lunch hour included" },
    { n: "< 1 s", label: "to pick up, no hold music" },
    { n: "1 log line", label: "for every patient record it touches" },
  ],
  heroCall: { when: "Thursday, 12:41 p.m.", kind: "Inbound, front desk at lunch", result: "Booked, confirmation texted", length: "34 seconds" },
  recordingPitch: "An existing patient books a cleaning over lunch: found by name and date of birth, offered two real openings, booked at the office she asked for.",
  recordingDescription: "Real scenario, the assistant answering as a fictional two-office practice. Press play, then read the transcript to see how it identified the patient before it opened the book.",

  steps: [
    { title: "It answers", body: "Every call, with your practice name and the recording notice your state requires. It asks how it can help and whether the caller is an existing patient." },
    { title: "It books", body: "It matches the patient by name and date of birth, offers open chair time with the right provider at the right office, and writes the appointment to your schedule." },
    { title: "It hands over", body: "Pain, bleeding, billing, insurance questions beyond what you accept: anything clinical or financial goes to your team, with the call summarised, never answered by the assistant." },
  ] as Step[],
  demoPitch: "The demo call takes twenty minutes and we run it on your own offices, providers and hours.",

  ladder: [
    { title: "Signature verified", body: "Every message about a call is signed by the phone provider. We refuse any that is not, so nothing can be written to your schedule by anyone but the call itself." },
    { title: "Patient matched", body: "Name and date of birth, matched forgivingly because speech-to-text spells names its own way. No match means no record is opened; a new patient is set up instead." },
    { title: "Slots checked", body: "Open chair time with the providers who do that kind of visit, at the office the patient asked for, for the next two weeks. Up to three offered, never more." },
    { title: "Appointment written", body: "The chosen slot is checked again the instant it is booked, so two callers can never take the same chair." },
    { title: "Audit logged", body: "Who accessed which record, when, why and with what outcome. Written as codes and a pseudonym, never free text, so the log itself holds no PHI." },
    { title: "Consent recorded", body: "The recording notice and the assistant disclosure are logged with the script version on every call. SMS consent is logged with the words the patient heard." },
    { title: "Reminder queued", body: "A confirmation text carrying only date, time, provider and office. Nothing about the reason for the visit ever goes by text." },
  ] as Step[],
  setup: [
    { title: "What we need from you", body: "Onboarding is a guided setup inside the product and takes under an hour. You give it your offices and their hours, your providers and what each one does, your appointment types and lengths, the insurance you accept, and the words it uses when it answers. Then you make a test call and forward your number." },
    { title: "Forwarding your number", body: "You keep your number. Forward it always, only when the desk does not pick up in four rings, or outside office hours. Most practices start with overflow and after hours and widen it once they trust it." },
    { title: "What you see", body: "A dashboard with the day's chair schedule per office, every call and what happened on it, the audit log an auditor would ask for, and the confirmations it sent. Technical detail sits behind an Advanced page." },
  ] as Step[],

  rules: [
    "Never gives clinical advice. Pain, swelling, bleeding or medication questions are handed to your team with the call summarised.",
    "Never discusses balances, claims or what insurance will pay. It states which plans you accept, and no more.",
    "Never reads out anything from a patient's record beyond the appointment it is booking.",
    "Never argues with a caller. When someone insists on a person, it transfers or takes a message with a callback promise.",
  ],
  moreRules: [
    "Never books a procedure it has not been told about. Anything outside your appointment types becomes a message for the desk.",
    "Never records a call without the disclosure your state requires; the opening line carries it.",
  ],
  handover: [
    { title: "Warm transfer", body: "During office hours, a caller who asks for a person, or any clinical or billing question, is transferred to your desk with a one-line summary spoken first, so nobody repeats themselves." },
    { title: "Emergency visit", body: "A patient in pain is offered the first emergency slot you keep open each day. If none is open, the call goes to the desk or the after-hours line you choose, never to an answer from the assistant." },
    { title: "Booking queue", body: "When the schedule cannot be read, or the request needs a person to decide, the assistant takes the details and promises a callback. The request lands in a queue your desk works within the hour." },
    { title: "Voicemail to task", body: "If a transfer is not answered, the assistant takes a message and creates a task instead of dropping the caller into a voicemail box nobody checks." },
  ] as Step[],

  integration: { name: "Dentrix", what: "patients and appointments" },
  integrations: [
    { system: "Dentrix, via NexHealth", what: "Finds patients by name and date of birth, reads open chair time, writes appointments and confirmations.", status: "Connect in onboarding. Open Dental and Eaglesoft through the same connector." },
    { system: "Built-in schedule", what: "The chair schedule inside the product, for practices that want to start before connecting their software.", status: "Included on every plan." },
    { system: "Twilio (SMS)", what: "Appointment confirmations and reminders carrying only date, time, provider and office. STOP handling.", status: "Switched on per practice once carrier registration clears." },
    { system: "Retell (voice)", what: "The phone line itself: numbers, call recording, transcripts, with a business associate agreement in place.", status: "Included; you never deal with it directly." },
    { system: "Email", what: "Daily summary, weekly report, missed-call alerts to the office manager.", status: "Included." },
  ],
  integrationsMore: "Curve, Denticon and Google Calendar are on the list. If your practice runs on something not named here, say so on the demo call; the booking step is built to be pointed at a new system without touching the rest.",

  plans: [
    { id: "starter", name: "Starter", price: 149, minutes: 300, blurb: "One number, one office, email notifications and the built-in schedule." },
    { id: "practice", name: "Practice", price: 349, minutes: 1000, blurb: "Three offices, practice software integration, confirmation texts when SMS is switched on, the weekly report.", popular: true },
    { id: "group", name: "Group", price: 799, minutes: 3000, blurb: "Unlimited offices, several agents, priority support, the business associate agreement for groups.", from: true },
  ],
  overagePerMinute: 0.25,
  pricingLead: "A typical scheduling call lasts two minutes. Three hundred minutes is about a hundred and fifty calls a month; a thousand covers a busy two-office practice.",
  planIncludes: [
    "A dedicated number, or forwarding from yours, with overflow and after-hours rules.",
    "The dashboard, the call log with what happened on every call, and the audit log for every record touched.",
    "A signed business associate agreement and the recording disclosure for your state.",
    "A booking queue for requests that need a person, worked from the dashboard.",
    "Onboarding with a person, and a test call before your number is forwarded.",
  ],

  faq: [
    { q: "Is it HIPAA compliant?", a: "It is built to be a business associate: a signed BAA is part of every plan, every access to a patient record is written to an audit log, the assistant handles scheduling only and refers anything clinical, and recordings live under the same controls as the rest of your data. The dashboard shows the log so you can see it for yourself." },
    { q: "Does it replace my front desk?", a: "No. It answers the calls that ring while your desk is busy, at lunch or after hours, and books into the same schedule. Your team sees every booking with a note on what the caller said, and takes over any call that needs a person." },
    { q: "Will it answer insurance questions?", a: "It states which plans you accept and nothing more. Balances, claims and what a plan will pay are always handed to your team." },
    { q: "How do I cancel?", a: "Month to month. Tell us and we forward your number back the same day." },
  ],
  faqTitle: "The ones every office manager asks",
  cta: { title: "See it on your own schedule", body: "The demo call takes twenty minutes. We set it up with your offices, your providers and your hours, then you call it." },
  bookLead: "Leave your details and someone from our team calls you within one business day to set a time. On the call we configure the assistant with your offices, providers and appointment types, and you phone it yourself.",
  bookTitle: "Twenty minutes, on your own schedule",
  formExample: { name: "Priya Raman", business: "Riverside Family Dental", message: "Book cleanings and new patient exams when the desk is busy, and never say anything clinical." },

  securityExtra: [
    { title: "What the assistant is told", body: "Only what it needs for the call: your offices and hours, your providers' names, the appointment types, and, once the caller is identified, the appointment being booked. It never sees clinical notes, balances or claims." },
    { title: "The audit log", body: "Every access to a patient record is logged with who, when, why and the outcome, as codes and a pseudonym rather than free text, so the log itself contains no protected health information. Your dashboard shows it live." },
  ] as Step[],
  privacyCaller: "The assistant records the call after telling you so, transcribes it, and stores your name, date of birth, phone number and the appointment it booked so the practice can see you. It handles scheduling only; anything clinical you say is passed to the practice and not acted on by the assistant.",
  baa: true,
} as const;

export type Plan = (typeof PRODUCT.plans)[number];
