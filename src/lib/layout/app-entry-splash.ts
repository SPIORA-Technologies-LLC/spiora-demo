/** Query flag: show Spiora boot splash once before the employee app shell. */
export const APP_ENTRY_SPLASH_PARAM = "enter";

export function withAppEntrySplash(pathOrUrl: string): string {
  try {
    const url = new URL(pathOrUrl, "https://spiora.local");
    url.searchParams.set(APP_ENTRY_SPLASH_PARAM, "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `/dashboard?${APP_ENTRY_SPLASH_PARAM}=1`;
  }
}
