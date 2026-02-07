import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getServerSession } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "repo read:user user:email",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.login = (profile as Record<string, unknown>).login as string;
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = token.accessToken;
      s.login = token.login;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};

export function auth() {
  return getServerSession(authOptions);
}
