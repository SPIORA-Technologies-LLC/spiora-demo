export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const { assertDemoEnvironmentSafe } = await import(
    "@/lib/demo/environment-guard"
  );
  assertDemoEnvironmentSafe();
}
