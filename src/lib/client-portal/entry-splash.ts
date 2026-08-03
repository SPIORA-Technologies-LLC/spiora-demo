/** Query flag: show Spiora logo splash before the client home welcome screen. */
export const CLIENT_PORTAL_ENTRY_SPLASH_PARAM = "enter";

export function withClientPortalEntrySplash(pathOrUrl: string): string {
  try {
    const url = new URL(pathOrUrl, "https://spiora.local");
    url.searchParams.set(CLIENT_PORTAL_ENTRY_SPLASH_PARAM, "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `/client?${CLIENT_PORTAL_ENTRY_SPLASH_PARAM}=1`;
  }
}
