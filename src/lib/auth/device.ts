/**
 * Utility to parse User-Agent headers into friendly device & browser descriptions.
 */
export function parseUserAgent(userAgent?: string | null): string {
  if (!userAgent || typeof userAgent !== "string") {
    return "Unknown Device";
  }

  const ua = userAgent.toLowerCase();

  // 1. Detect Operating System / Device Type
  let os = "Device";
  if (ua.includes("iphone")) {
    os = "iPhone";
  } else if (ua.includes("ipad")) {
    os = "iPad";
  } else if (ua.includes("android")) {
    os = "Android Device";
  } else if (ua.includes("win")) {
    os = "Windows";
  } else if (ua.includes("mac")) {
    os = "macOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  } else if (ua.includes("cros")) {
    os = "ChromeOS";
  }

  // 2. Detect Browser
  let browser = "Web Browser";
  if (ua.includes("edg/")) {
    browser = "Microsoft Edge";
  } else if (ua.includes("opr/") || ua.includes("opera")) {
    browser = "Opera";
  } else if (ua.includes("firefox/") || ua.includes("fxios/")) {
    browser = "Firefox";
  } else if (ua.includes("chrome/") || ua.includes("crios/")) {
    browser = "Chrome";
  } else if (ua.includes("safari/") && !ua.includes("chrome")) {
    browser = "Safari";
  }

  return `${browser} on ${os}`;
}
