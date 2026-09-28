/** To our sales inbox the moment a prospect asks for a demo. */
import { Button, Link, Section, Text } from "@react-email/components";
import Layout, { styles } from "./Layout";
import { PRODUCT } from "@/lib/product";

export interface LeadNotificationProps {
  leadId: number;
  name: string;
  business: string | null;
  email: string;
  phone: string;
  message: string | null;
  consent: boolean;
  receivedAt: string;
}

export default function LeadNotification(p: LeadNotificationProps) {
  const adminUrl = `${PRODUCT.siteUrl}/admin/leads/${p.leadId}`;
  return (
    <Layout preview={`${p.name}${p.business ? `, ${p.business}` : ""} asked for a ${PRODUCT.name} demo`} title="New demo request">
      <Text style={styles.p}>
        Someone asked for a demo on the {PRODUCT.name} site. Call them today if you can; the auto-reply told them to expect a call within one business day.
      </Text>
      <Section>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{p.name}</Text>
        <Text style={styles.label}>Business</Text>
        <Text style={styles.value}>{p.business || "(not given)"}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>
          <Link href={`tel:${p.phone}`} style={{ color: "#0f1626" }}>
            {p.phone}
          </Link>
        </Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>
          <Link href={`mailto:${p.email}`} style={{ color: "#0f1626" }}>
            {p.email}
          </Link>
        </Text>
        <Text style={styles.label}>What they want it to do</Text>
        <Text style={styles.value}>{p.message || "(nothing written)"}</Text>
        <Text style={styles.label}>Consent to call and text</Text>
        <Text style={styles.value}>{p.consent ? `Yes, recorded ${p.receivedAt}` : "No"}</Text>
      </Section>
      <Section style={{ margin: "20px 0 0" }}>
        <Button href={adminUrl} style={styles.button}>
          Open in the admin console
        </Button>
      </Section>
      <Text style={{ ...styles.small, margin: "16px 0 0" }}>
        Mark the lead contacted in the console once you have spoken. That stops the automatic follow-up emails.
      </Text>
    </Layout>
  );
}
