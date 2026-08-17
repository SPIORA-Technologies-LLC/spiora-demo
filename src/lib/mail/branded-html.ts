import { getCanonicalAppOrigin } from "@/lib/auth/canonical-app-origin";

const FALLBACK_ORIGIN = "https://www.spiora.ai";
const ICON_PATH = "/icons/icon-192x192.png";

export function escapeMailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wrapTransactionalEmailHtml(innerHtml: string): string {
  const origin = getCanonicalAppOrigin() ?? FALLBACK_ORIGIN;
  const iconUrl = `${origin}${ICON_PATH}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Inter,system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
  <tr>
    <td style="padding:0 0 16px 0">
      <img src="${escapeMailHtml(iconUrl)}" alt="SPIORA" width="48" height="48" style="display:block;border:0;border-radius:10px" />
    </td>
  </tr>
  <tr>
    <td>${innerHtml}</td>
  </tr>
</table>`;
}

export function defaultTransactionalEmailHtml(text: string): string {
  return wrapTransactionalEmailHtml(
    `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;line-height:1.5;margin:0">${escapeMailHtml(text)}</pre>`,
  );
}
