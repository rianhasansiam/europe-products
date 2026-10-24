const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseCredentialFreeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAirwallexHttpsUrl(value: string): boolean {
  return parseCredentialFreeUrl(value)?.protocol === "https:";
}

/**
 * Airwallex sandbox may return to the local development server. Public and
 * production destinations remain HTTPS-only; plain HTTP is restricted to an
 * exact loopback hostname.
 */
export function isAirwallexReturnUrl(
  value: string,
  environment: "sandbox" | "production" = "sandbox",
): boolean {
  const url = parseCredentialFreeUrl(value);
  if (!url) return false;
  if (url.protocol === "https:") return true;
  return (
    environment === "sandbox" &&
    url.protocol === "http:" &&
    LOOPBACK_HOSTNAMES.has(url.hostname)
  );
}
