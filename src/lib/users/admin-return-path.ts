const USERS_PATH = "/admin/users";

/**
 * Account actions may return to the member they changed, but never accept an
 * arbitrary redirect. The requested path must identify the same internal
 * member id already being authorized by the action.
 */
export function adminUserReturnPath(
  targetUserId: string,
  requestedPath: unknown
): string {
  const detailPath = targetUserId
    ? `${USERS_PATH}/${encodeURIComponent(targetUserId)}`
    : USERS_PATH;
  return requestedPath === detailPath ? detailPath : USERS_PATH;
}

export function adminUserResultPath(
  basePath: string,
  kind: "error" | "success",
  code: string
): string {
  const params = new URLSearchParams({ [kind]: code });
  return `${basePath}?${params}`;
}
