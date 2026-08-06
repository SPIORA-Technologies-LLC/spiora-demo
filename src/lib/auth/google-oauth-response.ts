export type OAuthStartCookie = {
  name: string;
  value: string;
  options?: {
    path?: string;
    httpOnly?: boolean;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    maxAge?: number;
  };
};

/** Pure helper for tests + start route — body URL + Set-Cookie lines. */
export function buildGoogleOAuthStartParts(
  url: string,
  mutations: OAuthStartCookie[],
): { body: { url: string }; setCookie: string[] } {
  return {
    body: { url },
    setCookie: mutations.map((cookie) => {
      let line = `${cookie.name}=${cookie.value}`;
      const path = cookie.options?.path ?? "/";
      line += `; Path=${path}`;
      if (cookie.options?.httpOnly) line += "; HttpOnly";
      if (cookie.options?.secure) line += "; Secure";
      if (cookie.options?.sameSite) {
        line += `; SameSite=${cookie.options.sameSite}`;
      }
      if (typeof cookie.options?.maxAge === "number") {
        line += `; Max-Age=${cookie.options.maxAge}`;
      }
      return line;
    }),
  };
}
