/** To the prospect within a minute of asking for a demo. */
import { Button, Section, Text } from "@react-email/components";
import Layout, { styles } from "./Layout";
import { PRODUCT } from "@/lib/product";

export default function LeadAutoReply({ firstName }: { firstName: string }) {
  return (
    <Layout preview={`Thanks ${firstName}, we will call you within one business day.`} title={`Thanks, ${firstName}. We will call you shortly.`}>
      <Text style={styles.p}>
        Your demo request reached a person. Someone from our team will call the number you gave within one business day to
        walk through {PRODUCT.name} and answer your questions.
      </Text>
      <Text style={styles.p}>In the meantime, here is what a call sounds like, and the live demo you can try yourself.</Text>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={`${PRODUCT.siteUrl}/#hear-it`} style={styles.button}>
          Hear a recorded call
        </Button>
      </Section>
      <Text style={styles.p}>
        Or open {PRODUCT.siteUrl}/demo, press Call, and speak to it the way a customer would.
      </Text>
    </Layout>
  );
}
