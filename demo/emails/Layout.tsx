/**
 * The frame every product email shares: plain, readable in every client,
 * product name at the top, company and unsubscribe note at the foot.
 */
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { PRODUCT } from "@/lib/product";

export const styles = {
  body: { backgroundColor: "#f4f6fb", fontFamily: "Geist, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: 12, margin: "0 auto", maxWidth: 560, padding: "32px 36px" },
  brand: { color: PRODUCT.accent.main, fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", margin: "0 0 20px", textTransform: "uppercase" as const },
  h1: { color: "#0f1626", fontSize: 22, fontWeight: 700, lineHeight: "30px", margin: "0 0 16px" },
  p: { color: "#2b3446", fontSize: 15, lineHeight: "24px", margin: "0 0 14px" },
  small: { color: "#7a859c", fontSize: 12, lineHeight: "18px", margin: "0 0 6px" },
  button: { backgroundColor: PRODUCT.accent.main, borderRadius: 8, color: "#ffffff", display: "inline-block", fontSize: 15, fontWeight: 600, padding: "12px 20px", textDecoration: "none" },
  quote: { borderLeft: "3px solid #ee4f1c", color: "#2b3446", fontSize: 14, lineHeight: "22px", margin: "0 0 14px", paddingLeft: 12 },
  hr: { borderColor: "#e9edf5", margin: "24px 0" },
  label: { color: "#7a859c", fontSize: 12, lineHeight: "16px", margin: "10px 0 2px", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  value: { color: "#0f1626", fontSize: 15, lineHeight: "22px", margin: 0 },
};

export default function Layout({ preview, title, children, footer }: { preview: string; title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{PRODUCT.name}</Text>
          <Heading as="h1" style={styles.h1}>
            {title}
          </Heading>
          {children}
          <Hr style={styles.hr} />
          <Section>
            {footer}
            <Text style={styles.small}>
              {PRODUCT.name} by {PRODUCT.company}. Questions? Reply to this email or write to{" "}
              <Link href={`mailto:${PRODUCT.salesInbox}`} style={{ color: PRODUCT.accent.main }}>
                {PRODUCT.salesInbox}
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
