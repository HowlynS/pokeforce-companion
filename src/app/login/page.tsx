import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { signInAction } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_fields: "Enter both an email and password.",
  invalid_credentials: "Incorrect email or password.",
  not_authorized: "That account is not authorized for admin access.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
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
    <AppShell>
      <PageHeader
        title="Admin sign-in"
        description="Sign in with the authorized administrator account."
      />

      {message ? (
        <p
          role="alert"
          style={{
            border: `1px solid ${designTokens.colors.danger}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.danger,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {message}
        </p>
      ) : null}

      <form
        action={signInAction}
        style={{
          display: "grid",
          gap: "16px",
          maxWidth: "360px",
        }}
      >
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
    </AppShell>
  );
}
