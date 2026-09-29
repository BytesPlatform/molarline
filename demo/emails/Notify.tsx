/**
 * The running-the-business emails: a moment the owner should know about,
 * the close-of-business summary, and the "is forwarding still on?" nudge
 * when a live line goes quiet. Shared across the three products; the
 * words that differ arrive as props from each product's callsites.
 */
import { Button, Section, Text } from "@react-email/components";
import Layout, { styles } from "./Layout";
import { PRODUCT } from "@/lib/product";

export function OwnerEvent({
  firstName,
  title,
  lines,
  ctaLabel,
  ctaPath,
}: {
  firstName: string;
  title: string;
  lines: string[];
  ctaLabel?: string;
  ctaPath?: string;
}) {
  return (
    <Layout preview={lines[0] ?? title} title={title}>
      <Text style={styles.p}>Hi {firstName}.</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.p}>
          {line}
        </Text>
      ))}
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}${ctaPath ?? "/app"}`} style={styles.button}>
          {ctaLabel ?? "Open the dashboard"}
        </Button>
      </Section>
    </Layout>
  );
}

export function DailySummary({
  firstName,
  dateLabel,
  lines,
  needsYou,
}: {
  firstName: string;
  dateLabel: string;
  lines: { label: string; value: string }[];
  needsYou: number;
}) {
  return (
    <Layout preview={`${dateLabel}: ${lines[0]?.value ?? ""} ${lines[0]?.label.toLowerCase() ?? ""}.`} title={`Today at a glance, ${dateLabel}`}>
      <Text style={styles.p}>Hi {firstName}. Here is what the assistant handled today.</Text>
      {lines.map((line) => (
        <Text key={line.label} style={styles.quote}>
          <strong>{line.value}</strong> {line.label.toLowerCase()}
        </Text>
      ))}
      {needsYou > 0 ? (
        <Text style={styles.p}>
          <strong>{needsYou}</strong> {needsYou === 1 ? "item is" : "items are"} waiting in the Needs-you list.
        </Text>
      ) : (
        <Text style={styles.p}>Nothing is waiting on you.</Text>
      )}
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/app`} style={styles.button}>
          Open the dashboard
        </Button>
      </Section>
    </Layout>
  );
}

export function ReEngagement({ firstName, number }: { firstName: string; number: string }) {
  return (
    <Layout preview="No calls have reached the assistant in a week." title="Is forwarding still on?">
      <Text style={styles.p}>
        Hi {firstName}. The assistant has not answered a call in seven days. That can be a quiet week, but it is also
        what it looks like when call forwarding gets switched off at the carrier.
      </Text>
      <Text style={styles.p}>
        The quickest check takes one minute: call <strong>{number || "your business line"}</strong> from your mobile. If
        the assistant answers, everything is fine and you can ignore this email.
      </Text>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/app/setup/test`} style={styles.button}>
          Run a test call
        </Button>
      </Section>
      <Text style={styles.p}>If it does not answer, reply to this email and we will look at it with you.</Text>
    </Layout>
  );
}
