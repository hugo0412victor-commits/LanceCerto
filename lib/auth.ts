import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { localAuthBypassEnabled } from "@/lib/auth-mode";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: {
          label: "E-mail",
          type: "email"
        },
        password: {
          label: "Senha",
          type: "password"
        }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          },
          include: {
            role: true
          }
        });

        if (!user || !user.active) {
          return null;
        }

        const validPassword = verifyPassword(credentials.password, user.passwordHash);
        if (!validPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.code
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.name = user.name;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as string | undefined) ?? "VIEWER";
      }

      return session;
    }
  }
};

export async function getServerAuthSession() {
  if (localAuthBypassEnabled) {
    const localUser = await prisma.user.findFirst({
      where: {
        active: true,
        role: {
          code: "ADMIN"
        }
      },
      include: {
        role: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return {
      user: {
        id: localUser?.id ?? "",
        name: localUser?.name ?? "Administrador Local",
        email: localUser?.email ?? "admin@local.dev",
        role: localUser?.role.code ?? "ADMIN"
      },
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
    };
  }

  return getServerSession(authOptions);
}
