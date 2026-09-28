/**
 * The three-step follow-up for a prospect who asked for a demo and has not
 * been reached yet. Day 1 the recorded call, day 3 how it works, day 7 the
 * last note. Each stops the moment the lead is marked contacted.
 */
import { Button, Section, Text } from "@react-email/components";
import Layout, { styles } from "./Layout";
import { PRODUCT } from "@/lib/product";

export type FollowUpStep = 1 | 2 | 3;

export function followUpSubject(step: FollowUpStep, firstName: string): string {
  switch (step) {
    case 1:
      return `${firstName}, a real call answered by ${PRODUCT.name}`;
    case 2:
      return `How ${PRODUCT.name} fits into your day`;
    default:
      return `Still want the ${PRODUCT.name} demo, ${firstName}?`;
  }
}

export default function LeadFollowUp({ step, firstName }: { step: FollowUpStep; firstName: string }) {
  if (step === 1) {
    return (
      <Layout preview={PRODUCT.recordingPitch} title={`Hear ${PRODUCT.name} on a real call`}>
        <Text style={styles.p}>
          Hi {firstName}. We tried to reach you and will try again, but the quickest way to see whether {PRODUCT.name} is
          for you is to hear it. This is a recorded call: {PRODUCT.recordingPitch}
        </Text>
        <Section style={{ margin: "8px 0 20px" }}>
          <Button href={`${PRODUCT.siteUrl}/#hear-it`} style={styles.button}>
            Play the call
          </Button>
        </Section>
        <Text style={styles.p}>Reply to this email if a particular time suits you for the demo call.</Text>
      </Layout>
    );
  }
  if (step === 2) {
    return (
      <Layout preview="Answers, books, hands over. Three steps." title="How it works, in three steps">
        {PRODUCT.steps.map((step) => (
          <Text key={step.title} style={styles.p}>
            <strong>{step.title}.</strong> {step.body}
          </Text>
        ))}
        <Text style={styles.p}>{PRODUCT.demoPitch}</Text>
        <Section style={{ margin: "8px 0 20px" }}>
          <Button href={`${PRODUCT.siteUrl}/book-a-demo`} style={styles.button}>
            Pick a time for the demo
          </Button>
        </Section>
      </Layout>
    );
  }
  return (
    <Layout preview="Last note from us." title={`Still interested, ${firstName}?`}>
      <Text style={styles.p}>
        This is the last email we will send about your demo request. If the timing was wrong, that is fine; reply whenever
        it is right and we will pick it up from there.
      </Text>
      <Text style={styles.p}>If you would still like the demo, reply with a good time to call, or use the button.</Text>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/book-a-demo`} style={styles.button}>
          Book the demo
        </Button>
      </Section>
    </Layout>
  );
}
