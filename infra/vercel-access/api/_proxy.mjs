const UPSTREAM = "https://music-school-library.oregu93.workers.dev";

export function publicOrigin(req) {
  const raw = req.headers["x-forwarded-host"] || req.headers.host;
  const host = Array.isArray(raw) ? raw[0] : raw;
  if (!host) throw new Error("Missing request host");
  return `https://${host}`;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return combined.split(/,\s*(?=[^;,]+=)/);
}

function rewriteWorkerLocation(req, location) {
  if (!location) return location;
  const url = new URL(location);
  if (url.origin === UPSTREAM) {
    return publicOrigin(req) + url.pathname + url.search + url.hash;
  }
  return location;
}

export async function relayAuth(req, res, upstreamPath, mapLocation) {
  const incoming = new URL(req.url, publicOrigin(req));
  const target = new URL(upstreamPath + incoming.search, UPSTREAM);
  const headers = new Headers();

  for (const name of ["cookie", "user-agent", "accept", "accept-language"]) {
    const value = req.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    redirect: "manual",
  });

  const skip = new Set([
    "connection", "content-length", "content-encoding", "keep-alive",
    "location", "set-cookie", "transfer-encoding",
  ]);

  for (const [key, value] of upstream.headers) {
    if (!skip.has(key.toLowerCase())) res.setHeader(key, value);
  }

  const cookies = getSetCookies(upstream.headers);
  if (cookies.length) res.setHeader("Set-Cookie", cookies);

  const location = upstream.headers.get("location");
  if (location) {
    res.setHeader(
      "Location",
      mapLocation ? mapLocation(location) : rewriteWorkerLocation(req, location),
    );
  }

  res.statusCode = upstream.status;
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

export { rewriteWorkerLocation };
