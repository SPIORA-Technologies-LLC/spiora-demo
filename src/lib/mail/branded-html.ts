export function escapeMailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wrapTransactionalEmailHtml(innerHtml: string): string {
  return `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.5;color:#1a1a1a">${innerHtml}</div>`;
}

export function defaultTransactionalEmailHtml(text: string): string {
  return wrapTransactionalEmailHtml(
    `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;line-height:1.5;margin:0">${escapeMailHtml(text)}</pre>`,
  );
}
