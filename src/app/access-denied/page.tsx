import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="public-site-shell">
      <div className="public-site-container public-site-main">
        <div style={{ display: "grid", gap: "16px", maxWidth: "560px" }}>
          <h1 style={{ margin: 0 }}>Permission required</h1>
          <p style={{ margin: 0 }}>
            Your account is active, but it does not have permission to open
            this workspace or perform that action.
          </p>
          <Link
            href="/"
            className="btn btn-secondary"
            style={{ width: "fit-content" }}
          >
            Return to Merchants Codex
          </Link>
        </div>
      </div>
    </main>
  );
}
