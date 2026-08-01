import type { AppUser, Prisma } from "@/generated/prisma/client";
import { auditActor, writeAuditEvent } from "./writer";

type AuditClient = Pick<Prisma.TransactionClient, "auditEvent">;

type ContentAuditInput = {
  actor: AppUser;
  operation: "create" | "edit" | "delete";
  targetType: string;
  targetId: string;
  targetLabel: string;
  formData?: FormData;
  changedArea?: string;
};

/**
 * Records successful authored-content mutations without copying submitted
 * values into durable history. Rich text, files, and other form payloads are
 * deliberately represented only by bounded field names and intent flags.
 */
export async function writeContentAudit(
  client: AuditClient,
  input: ContentAuditInput
) {
  const submittedFields = input.formData
    ? [...new Set([...input.formData.keys()])]
        .filter(
          (field) =>
            ![
              "id",
              "image",
              "password",
              "temporaryPassword",
              "description",
              "descriptionRich",
            ].includes(field)
        )
        .slice(0, 20)
    : [];

  return writeAuditEvent(client, {
    actor: auditActor(input.actor),
    action: `gameplay.${input.operation}`,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    metadata: {
      changedArea: input.changedArea ?? "general",
      submittedFields,
      contentChanged:
        input.formData?.has("descriptionRich") ||
        input.formData?.has("description") ||
        false,
      verificationRequested:
        input.formData?.get("markVerified") === "on" ||
        input.formData?.get("verified") === "on",
    },
  });
}
