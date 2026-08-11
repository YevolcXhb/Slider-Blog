import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth configuration.
 *
 * This file MUST NOT import `node:crypto`, `@/lib/prisma`, or any other
 * Node-only module. It is imported by `src/proxy.ts` which runs in
 * the Edge Runtime.
 *
 * The full configuration (with Credentials provider that uses scrypt +
 * Prisma) lives in `src/lib/auth.ts` and is only imported by Server
 * Components, Route Handlers, and Server Actions — all of which run on
 * the Node.js runtime.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      if (trigger === "update" && session) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role;
      }
      return session;
    },
  },
  providers: [], // empty in edge config — populated in src/lib/auth.ts
  session: {
    strategy: "jwt",
  },
};
