import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            role: {
              include: { permissions: true },
            },
          },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        const permissions = user.role.permissions.map((p) => p.code);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          permissions,
          passwordChangeRequired: user.passwordChangeRequired,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          role?: string;
          permissions?: string[];
          passwordChangeRequired?: boolean;
        };
        token.id = u.id;
        token.role = u.role;
        token.permissions = u.permissions ?? [];
        token.passwordChangeRequired = u.passwordChangeRequired ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as {
          id?: string;
          role?: string;
          permissions?: string[];
          passwordChangeRequired?: boolean;
        };
        u.id = token.id as string;
        u.role = token.role as string;
        u.permissions = (token.permissions as string[]) ?? [];
        u.passwordChangeRequired = (token.passwordChangeRequired as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
