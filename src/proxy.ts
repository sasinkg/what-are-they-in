import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export async function proxy(req: Parameters<typeof auth>[0]) {
  return auth(req as Parameters<typeof auth>[0]);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
