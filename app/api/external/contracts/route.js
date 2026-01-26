// app/api/external/contracts/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickUrl() {
  return (
    process.env.CONTRACTS_API ||
    process.env.NEXT_PUBLIC_CONTRACTS_API ||
    "https://contact-management-three-jade.vercel.app/api/public/approved-contracts"
  ).trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clip(s, max = 2500) {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max) + "…(clipped)" : str;
}

function isRetryableStatus(status) {
  return status >= 500 && status <= 599;
}

async function fetchWithRetry(url, { retries = 2, timeoutMs = 20000 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json, */*",
          "User-Agent": "ConsiderationNextProxy/1.0",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const raw = await res.text().catch(() => "");

      if (!res.ok) {
        if (isRetryableStatus(res.status) && attempt < retries) {
          clearTimeout(timer);
          await sleep(600 * Math.pow(2, attempt));
          continue;
        }
        return { ok: false, status: res.status, raw };
      }

      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        return {
          ok: false,
          status: 502,
          raw: `JSON parse failed. Raw: ${raw}`,
        };
      }

      return { ok: true, status: 200, json };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        clearTimeout(timer);
        await sleep(600 * Math.pow(2, attempt));
        continue;
      }
      return {
        ok: false,
        status: 502,
        raw: err?.name === "AbortError" ? "timeout" : err?.message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 502, raw: lastErr?.message || "fetch failed" };
}

export async function GET() {
  const url = pickUrl();
  if (!url) {
    return Response.json(
      { error: "Missing CONTRACTS_API (or NEXT_PUBLIC_CONTRACTS_API)" },
      { status: 500 },
    );
  }

  const r = await fetchWithRetry(url, { retries: 2, timeoutMs: 20000 });

  if (!r.ok) {
    return Response.json(
      {
        error:
          r.raw === "timeout"
            ? "Contracts API timeout. Please retry."
            : "Contracts API failed",
        upstreamStatus: r.status,
        upstreamHost: (() => {
          try {
            return new URL(url).host;
          } catch {
            return "unknown";
          }
        })(),
        details: clip(r.raw),
      },
      { status: 502 },
    );
  }

  const json = r.json;

  const list =
    (Array.isArray(json) && json) ||
    (Array.isArray(json?.data) && json.data) ||
    (Array.isArray(json?.contracts) && json.contracts) ||
    (Array.isArray(json?.items) && json.items) ||
    [];

  return Response.json(list, { status: 200 });
}
