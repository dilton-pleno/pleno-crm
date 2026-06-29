import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hitRateLimit, clearRateLimit } from "@/lib/rate-limit";
import type { Role } from "@pleno-crm/types";

// Força bruta: no máx. 8 tentativas por (email+IP) a cada 15 min.
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function clientIp(request: Request | undefined): string {
  const xff = request?.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || "unknown";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    // Apenas login por credenciais. O provider Google foi removido: não era
    // exposto na UI e permitia autenticação sem autorização (sem allowlist).
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase();
        const key = `login:${email}|${clientIp(request)}`;
        if (!hitRateLimit(key, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS).allowed) {
          return null; // muitas tentativas; bloqueia temporariamente
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        clearRateLimit(key); // sucesso: zera o contador
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
});

// No NextAuth v5 (Auth.js) o tipo JWT estende Record<string, unknown>,
// portanto token.id e token.role sao atribuiveis sem augmentar o modulo
// next-auth/jwt (cujo augment quebra a resolucao sob moduleResolution bundler).
declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }
}
