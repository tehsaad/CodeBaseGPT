import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lazyDb, schema } from "@/lib/db";
import { env, oauthStatus } from "@/lib/env";
import { hashPassword, verifyPassword, PASSWORD_MAX, PASSWORD_MIN } from "./password";
import { sendEmail } from "./email";

function buildAuth() {
  const e = env();
  const oauth = oauthStatus(e);
  const secret =
    e.BETTER_AUTH_SECRET ??
    (e.NODE_ENV === "production" ? undefined : "dev-only-insecure-secret-change-me-0123456789");
  if (!secret) throw new Error("BETTER_AUTH_SECRET must be set in production");

  return betterAuth({
    appName: "CodeBaseGPT",
    secret,
    baseURL: e.BETTER_AUTH_URL,
    database: drizzleAdapter(lazyDb, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      password: { hash: hashPassword, verify: verifyPassword },
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: oauth.email
        ? async ({ user, url }) => {
            await sendEmail({
              to: user.email,
              subject: "Reset your CodeBaseGPT password",
              text: `Use this link to reset your password. It expires in one hour.\n\n${url}\n\nIf you didn't request this, ignore this email.`,
            });
          }
        : undefined,
    },
    emailVerification: oauth.email
      ? {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }) => {
            await sendEmail({
              to: user.email,
              subject: "Verify your CodeBaseGPT email",
              text: `Confirm your email address:\n\n${url}`,
            });
          },
        }
      : undefined,
    socialProviders: {
      ...(oauth.github
        ? {
            github: {
              clientId: e.GITHUB_CLIENT_ID!,
              clientSecret: e.GITHUB_CLIENT_SECRET!,
              scope: ["read:user", "user:email"],
            },
          }
        : {}),
      ...(oauth.google
        ? { google: { clientId: e.GOOGLE_CLIENT_ID!, clientSecret: e.GOOGLE_CLIENT_SECRET! } }
        : {}),
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: e.NODE_ENV !== "test",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof buildAuth>;
const g = globalThis as unknown as { __cbgAuth?: Auth };

export function getAuth(): Auth {
  g.__cbgAuth ??= buildAuth();
  return g.__cbgAuth;
}

export function resetAuthForTests() {
  g.__cbgAuth = undefined;
}
