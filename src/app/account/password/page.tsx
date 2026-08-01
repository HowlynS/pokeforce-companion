import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireActiveSiteUser } from "@/lib/auth/authorization";
import { changeOwnPasswordAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireActiveSiteUser();
  const { error, success } = await searchParams;
  const errorText =
    error === "invalid_password"
      ? "Use a password between 12 and 128 characters."
      : error === "password_mismatch"
        ? "The passwords do not match."
        : error
          ? "The password could not be changed. Try again."
          : null;

  return (
    <AppShell>
      <PageHeader
        title="Change password"
        description="Replace your temporary password with a private password you do not use elsewhere."
      />
      {errorText ? <p role="alert" className="banner banner-error">{errorText}</p> : null}
      {success ? <p role="status" className="banner banner-success">Password changed.</p> : null}
      <form action={changeOwnPasswordAction} className="form-grid" style={{ maxWidth: "480px" }}>
        <label className="form-field">
          <span className="form-field-label">New password</span>
          <input className="form-input" type="password" name="password" minLength={12} maxLength={128} required autoComplete="new-password" />
        </label>
        <label className="form-field">
          <span className="form-field-label">Confirm new password</span>
          <input className="form-input" type="password" name="passwordConfirmation" minLength={12} maxLength={128} required autoComplete="new-password" />
        </label>
        <button type="submit" className="btn btn-primary">Change password</button>
      </form>
    </AppShell>
  );
}
