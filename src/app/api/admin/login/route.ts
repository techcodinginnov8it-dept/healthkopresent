import { NextResponse } from "next/server";
import { loginAdmin } from "@/app/actions/auth";

function getRedirectUrl(request: Request, pathname: string) {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost || headers.get("host") || "";
  const forwardedProto = headers.get("x-forwarded-proto") || "http";
  const fallbackOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const isBindableHost = host && !/^0\.0\.0\.0(?::\d+)?$/.test(host) && !/^::(?::\d+)?$/.test(host);
  const origin = isBindableHost ? `${forwardedProto}://${host}` : fallbackOrigin;

  return new URL(pathname, origin);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let email = "";
    let password = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { email?: string; password?: string };
      email = body.email ?? "";
      password = body.password ?? "";
    } else {
      const formData = await request.formData();
      email = String(formData.get("email") ?? "");
      password = String(formData.get("password") ?? "");
    }

    const result = await loginAdmin({ email, password });

    if (!result.success) {
      return NextResponse.redirect(getRedirectUrl(request, "/admin/signin?error=1"), 303);
    }

    return NextResponse.redirect(getRedirectUrl(request, "/admin/dashboard"), 303);
  } catch (error) {
    console.error("Admin login route failed:", error);
    return NextResponse.redirect(getRedirectUrl(request, "/admin/signin?error=1"), 303);
  }
}
