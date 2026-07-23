import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      sub: string;
      name: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
