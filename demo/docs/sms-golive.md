# Switching SMS on for a customer

Texts are built and dormant: every message already flows through the
sender with consent and STOP handling, logged with provider `preview`.
Turning a customer live is configuration, not code.

## 1. Twilio account and number

1. In the Twilio console create (or reuse) a Messaging Service.
2. Buy a local number in the customer's area code, or port the number the
   assistant already answers on if texting should come from the same line.
3. Register A2P 10DLC: one brand for the platform, one campaign per use
   case ("customer service and appointment notifications" fits). Budget a
   few days for carrier approval; nothing sends reliably before it.

## 2. Point the number at the product

In the Twilio number's Messaging settings, set the inbound webhook to

    https://<the product's host>/api/twilio/inbound   (HTTP POST)

That route answers STOP, START and HELP itself and keeps the suppression
list in step. It validates Twilio's signature once the auth token is set.

## 3. Environment variables

On the Vercel project set, then redeploy:

    TWILIO_ACCOUNT_SID=ACxxxxxxxx
    TWILIO_AUTH_TOKEN=xxxxxxxx
    TWILIO_FROM_NUMBER=+1XXXXXXXXXX

The sender flips from `preview` to `twilio` on its own; the Settings page
stops saying "contact us to enable".

## 4. Prove it before telling the customer

1. From your own phone, text STOP to the number; expect the opt-out
   confirmation, and the number on the suppression list.
2. Text START; expect the opt-in confirmation.
3. Make a test call that books; expect the confirmation text, and a
   `sent` row (not `queued`) in the messages log on the Advanced page.

## 5. What never changes

- No text goes to a number without a recorded opt-in where the product
  requires one, and never to a number that said STOP.
- Every message is logged before it is sent; a failed send marks the row
  `failed` and shows on the dashboard, it never throws into a call.
