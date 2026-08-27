/**
 * Prints VAPID keys for Web Push. Copy into .env.local and Vercel env.
 * Usage: node --use-system-ca ./scripts/generate-vapid-keys.mjs
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
process.stdout.write(
  [
    "Add these to .env.local and Vercel:",
    "",
    `WEB_PUSH_VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `WEB_PUSH_VAPID_PRIVATE_KEY=${keys.privateKey}`,
    "WEB_PUSH_VAPID_SUBJECT=mailto:you@example.com",
    "",
  ].join("\n"),
);
