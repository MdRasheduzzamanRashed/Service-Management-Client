export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always fresh, no caching

function pickUrl() {
  // prefer server-only env, fallback to NEXT_PUBLIC if you used that
  return (
    process.env.CONTRACTS_API ||
    process.env.NEXT_PUBLIC_CONTRACTS_API ||
    ""
  ).trim();
}

export async function GET() {
  const url = pickUrl();
  if (!url) {
    return Response.json(
      { error: "Missing CONTRACTS_API (or NEXT_PUBLIC_CONTRACTS_API)" },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json, */*" },
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await res.text();

    if (!res.ok) {
      return Response.json(
        { error: `Contracts API failed: ${res.status}`, raw },
        { status: 502 },
      );
    }

    // Parse JSON safely
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "Contracts JSON parse failed", raw },
        { status: 502 },
      );
    }

    const list =
      (Array.isArray(json) && json) ||
      (Array.isArray(json?.data) && json.data) ||
      (Array.isArray(json?.contracts) && json.contracts) ||
      [];

    return Response.json(list, { status: 200 });
  } catch (err) {
    const msg =
      err?.name === "AbortError"
        ? "Contracts API timeout"
        : err?.message || "Contracts fetch failed";

    return Response.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
