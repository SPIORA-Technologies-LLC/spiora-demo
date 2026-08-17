export function readRequestAuditMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null;
  const userAgent = request.headers.get("user-agent");
  return {
    ipAddress: ip && ip.length <= 128 ? ip : null,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
  };
}
