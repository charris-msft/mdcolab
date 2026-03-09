import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getServerSession } from "next-auth";
import { isEmuUsername } from "@/lib/auth-utils";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "repo read:user" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        const login = (profile as Record<string, unknown>).login as string;
        token.login = login;
        token.isEmu = isEmuUsername(login);
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = token.accessToken;
      s.login = token.login;
      s.isEmu = token.isEmu ?? false;
      return session;
    },
  },
  pages: {
    // After GitHub App installation, GitHub redirects with ?setup_action=install
    // which causes an OAuthCallback error. Custom sign-in page handles this gracefully.
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
};

export function auth() {
  return getServerSession(authOptions);
}
