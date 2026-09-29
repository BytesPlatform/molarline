/**
 * The emails around onboarding: welcome on first sign-in, "finish your
 * setup" nudges while it is unfinished, "your number is live", the day-3
 * check-in and the day-7 first report. Shared across the three products;
 * the words that differ come from lib/product.ts and lib/stats.ts.
 */
import { Button, Section, Text } from "@react-email/components";
import Layout, { styles } from "./Layout";
import { PRODUCT } from "@/lib/product";
import type { WeekStats } from "@/lib/stats";

export function Welcome({ firstName, businessName }: { firstName: string; businessName: string }) {
  return (
    <Layout preview={`Your ${PRODUCT.name} workspace for ${businessName} is ready to set up.`} title={`Welcome, ${firstName}`}>
      <Text style={styles.p}>
        Your {PRODUCT.name} workspace for {businessName} is open. Setup takes about ten minutes: your hours, your team, how
        the assistant should answer, and a test call at the end. You can stop at any step and come back; it saves as you go.
      </Text>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/app/setup`} style={styles.button}>
          Start the setup
        </Button>
      </Section>
      <Text style={styles.p}>If anything is unclear, reply to this email and a person answers.</Text>
    </Layout>
  );
}

export function FinishSetup({ firstName, step, stepTitle, hoursSince }: { firstName: string; step: number; stepTitle: string; hoursSince: number }) {
  return (
    <Layout preview={`Your ${PRODUCT.name} setup is waiting at step ${step}.`} title={`${firstName}, your setup is ${step} of 8 done`}>
      <Text style={styles.p}>
        You started setting up {PRODUCT.name} {hoursSince >= 48 ? "a few days" : "yesterday"} and stopped at{" "}
        <strong>{stepTitle}</strong>. Everything you entered is saved. The rest takes a few minutes, and the assistant
        cannot answer a call until it is done.
      </Text>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/app/setup`} style={styles.button}>
          Pick up where you left off
        </Button>
      </Section>
      <Text style={styles.p}>Stuck on something? Reply and we will finish it with you on a call.</Text>
    </Layout>
  );
}

export function NumberLive({ firstName, number, forwarding }: { firstName: string; number: string; forwarding: string[] }) {
  return (
    <Layout preview={`Your assistant answers on ${number}.`} title="Your number is live">
      <Text style={styles.p}>
        Hi {firstName}. Your assistant now answers on <strong>{number}</strong>. Call it from your mobile to hear it, then
        forward your line to it whenever you are ready.
      </Text>
      {forwarding.length ? (
        <>
          <Text style={{ ...styles.p, fontWeight: 600 }}>To forward your existing number:</Text>
          {forwarding.map((line) => (
            <Text key={line} style={styles.quote}>
              {line}
            </Text>
          ))}
        </>
      ) : null}
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/app`} style={styles.button}>
          Open your dashboard
        </Button>
      </Section>
    </Layout>
  );
}

export function FirstCallCheckIn({ firstName, calls }: { firstName: string; calls: number }) {
  return (
    <Layout preview="How did the first calls go?" title={`${firstName}, how did the first calls go?`}>
      <Text style={styles.p}>
        {calls > 0
          ? `Your assistant has handled ${calls} call${calls === 1 ? "" : "s"} since it went live. Each one is in your dashboard with a transcript and the steps it took.`
          : "Your assistant has not taken a call yet. If your number is forwarded, that just means a quiet few days. If it is not, the forwarding step is in your dashboard under Settings."}
      </Text>
      <Text style={styles.p}>
        If a call did not go the way you wanted, open it, find the step, and change the rule in Settings. The assistant
        follows the new rule on the next call.
      </Text>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/app`} style={styles.button}>
          See the calls
        </Button>
      </Section>
    </Layout>
  );
}

export function WeeklyReport({ firstName, stats }: { firstName: string; stats: WeekStats }) {
  return (
    <Layout preview={stats.lines.map((l) => `${l.value} ${l.label.toLowerCase()}`).join(", ")} title={`Your first week with ${PRODUCT.name}`}>
      <Text style={styles.p}>Hi {firstName}. Here is the week in numbers.</Text>
      <Section>
        {stats.lines.map((l) => (
          <div key={l.label}>
            <Text style={styles.label}>{l.label}</Text>
            <Text style={styles.value}>{l.value}</Text>
          </div>
        ))}
      </Section>
      <Section style={{ margin: "20px 0 0" }}>
        <Button href={`${PRODUCT.siteUrl}/app`} style={styles.button}>
          Open the dashboard
        </Button>
      </Section>
      <Text style={{ ...styles.small, margin: "16px 0 0" }}>This report arrives every Monday from now on.</Text>
    </Layout>
  );
}
