import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  SERVICE_TEST_BUCKET,
  createSignedInAdminClient,
  signOutServiceClient,
} from "@/lib/testing/supabase-service";
import { PUBLIC_DESIGN_IMAGE_PATH } from "@/lib/public-design/fixtures";

function storageParts(): { folder: string; name: string } {
  const [folder, name, ...extra] = PUBLIC_DESIGN_IMAGE_PATH.split("/");
  if (!folder || !name || extra.length > 0 || !name.startsWith("test-service-public-design-")) {
    throw new Error("Refusing public-design storage access: fixture path is unsafe.");
  }
  return { folder, name };
}

export async function ensurePublicDesignFixtureStorage(): Promise<void> {
  const { folder, name } = storageParts();
  const admin = await createSignedInAdminClient();
  try {
    const { data, error } = await admin.storage
      .from(SERVICE_TEST_BUCKET)
      .list(folder, { limit: 20, search: name });
    if (error) throw new Error(`Could not inspect public-design fixture storage (status ${error.status ?? "unknown"}).`);
    if ((data ?? []).some((object) => object.name === name)) return;

    const bytes = await readFile(path.join(process.cwd(), "e2e", "fixtures", "tiny-valid.png"));
    const { error: uploadError } = await admin.storage
      .from(SERVICE_TEST_BUCKET)
      .upload(PUBLIC_DESIGN_IMAGE_PATH, bytes, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw new Error(`Could not upload public-design fixture image (status ${uploadError.status ?? "unknown"}).`);
  } finally {
    await signOutServiceClient(admin);
  }
}

export async function cleanupPublicDesignFixtureStorage(): Promise<number> {
  storageParts();
  const admin = await createSignedInAdminClient();
  try {
    const { error } = await admin.storage
      .from(SERVICE_TEST_BUCKET)
      .remove([PUBLIC_DESIGN_IMAGE_PATH]);
    if (error) throw new Error(`Could not remove public-design fixture image (status ${error.status ?? "unknown"}).`);
    return 1;
  } finally {
    await signOutServiceClient(admin);
  }
}
