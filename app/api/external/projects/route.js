export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickUrl() {
  return (
    process.env.PROJECTS_API ||
    process.env.NEXT_PUBLIC_PROJECTS_API ||
    ""
  ).trim();
}

export async function GET() {
  const url = pickUrl();
  if (!url) {
    return Response.json(
      { error: "Missing PROJECTS_API (or NEXT_PUBLIC_PROJECTS_API)" },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json, */*" },
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await res.text();

    if (!res.ok) {
      return Response.json(
        { error: `Projects API failed: ${res.status}`, raw },
        { status: 502 },
      );
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "Projects JSON parse failed", raw },
        { status: 502 },
      );
    }

    const list =
      (Array.isArray(json) && json) ||
      (Array.isArray(json?.data) && json.data) ||
      (Array.isArray(json?.projects) && json.projects) ||
      [];

    return Response.json(list, { status: 200 });
  } catch (err) {
    const msg =
      err?.name === "AbortError"
        ? "Projects API timeout"
        : err?.message || "Projects fetch failed";

    return Response.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
