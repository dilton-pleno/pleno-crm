import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccess } from "@/lib/permissions";
import type { Module } from "@pleno-crm/types";

const PUBLIC_ROUTES = ["/login"];

const ROUTE_MODULE_MAP: Record<string, Module> = {
  "/visao-geral": "visao_geral",
  "/atendimento": "atendimento",
  "/contatos": "contatos",
  "/kanban": "kanban",
  "/campanhas": "campanhas",
  "/ecommerce": "ecommerce",
  "/configuracoes": "configuracoes",
};

export default auth((req: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (req.auth?.user) {
      return NextResponse.redirect(new URL("/atendimento", req.url));
    }
    return NextResponse.next();
  }

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user.role as string;

  for (const [routePrefix, mod] of Object.entries(ROUTE_MODULE_MAP)) {
    if (pathname.startsWith(routePrefix)) {
      if (!canAccess(role, mod)) {
        return NextResponse.redirect(new URL("/visao-geral", req.url));
      }
      break;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
