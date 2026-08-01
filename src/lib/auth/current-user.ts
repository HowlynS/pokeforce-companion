import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { resolveApplicationUserForIdentity } from "./bootstrap-owner";

export const getAuthenticatedIdentity = cache(async function getAuthenticatedIdentity() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentAppUser = cache(async function getCurrentAppUser() {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    return null;
  }

  return resolveApplicationUserForIdentity(
    prisma,
    identity,
    process.env.ADMIN_EMAIL
  );
});
