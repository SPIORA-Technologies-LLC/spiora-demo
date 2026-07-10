const DEMO_NAV_SEPARATOR = "\u2063";

export function encodeDemoNavMessage(
  display: string,
  href: string,
): string {
  return `${display}${DEMO_NAV_SEPARATOR}${href}`;
}

export function decodeDemoNavMessage(message: string): {
  display: string;
  href: string | null;
} {
  const index = message.indexOf(DEMO_NAV_SEPARATOR);
  if (index === -1) {
    return { display: message, href: null };
  }

  const display = message.slice(0, index);
  const href = message.slice(index + DEMO_NAV_SEPARATOR.length).trim();
  return {
    display,
    href: href.startsWith("/") ? href : null,
  };
}

export function getDemoNavHref(message: string | undefined): string | null {
  if (!message) return null;
  return decodeDemoNavMessage(message).href;
}
