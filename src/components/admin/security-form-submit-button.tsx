"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SecurityFormSubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
