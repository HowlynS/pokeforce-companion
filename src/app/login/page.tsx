import Image from "next/image";
import { redirect } from "next/navigation";
import { designTokens } from "@/lib/design-tokens";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { safeReturnPath } from "@/lib/auth/return-path";
import {
  DEFAULT_HEADER_LOGO_HEIGHT,
  DEFAULT_HEADER_LOGO_URL,
  DEFAULT_HEADER_LOGO_WIDTH,
} from "@/lib/appearance/defaults";
import { signInAction } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_fields: "Enter both an email and password.",
  invalid_credentials: "Incorrect email or password.",
  session_expired: "Your session expired. Sign in again to continue.",
  unprovisioned:
    "This account does not have access to Merchants Codex. Contact the owner outside the application if access is expected.",
  disabled:
    "This account is disabled. Contact the owner outside the application if access is expected.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const returnTo = safeReturnPath(next);
  const currentUser = await getCurrentAppUser();
  if (currentUser?.status === "ACTIVE") {
    redirect(returnTo);
  }

  const message = error ? errorMessages[error] ?? "Sign-in failed." : null;
  const inputStyle = {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: designTokens.radius.sm,
    background: designTokens.colors.surface,
    color: designTokens.colors.text,
    padding: "10px 12px",
    fontSize: "16px",
  };

  return (
    <main className="public-site-shell">
      <div className="public-site-container public-site-main">
        <div style={{ display: "grid", gap: "24px", maxWidth: "420px" }}>
          <Image
            src={DEFAULT_HEADER_LOGO_URL}
            width={DEFAULT_HEADER_LOGO_WIDTH}
            height={DEFAULT_HEADER_LOGO_HEIGHT}
            alt="Merchants Codex"
            priority
            style={{ width: "min(100%, 280px)", height: "auto" }}
          />

          <header style={{ display: "grid", gap: "8px" }}>
            <h1 style={{ margin: 0 }}>Private beta sign-in</h1>
            <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
              Merchants Codex is restricted during private beta. Access is
              limited to approved accounts.
            </p>
          </header>

          {message ? (
            <p
              role="alert"
              style={{
                border: `1px solid ${designTokens.colors.danger}`,
                borderRadius: designTokens.radius.sm,
                background: designTokens.colors.surfaceSoft,
                color: designTokens.colors.danger,
                padding: "12px 16px",
                margin: 0,
              }}
            >
              {message}
            </p>
          ) : null}

          <form action={signInAction} style={{ display: "grid", gap: "16px" }}>
            <input type="hidden" name="next" value={returnTo} />
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ color: designTokens.colors.textMuted }}>Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ color: designTokens.colors.textMuted }}>
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
