const AUTH_PATHS = new Set(["/login", "/access-denied"]);
const INDEXING_PATHS = new Set(["/robots.txt", "/sitemap.xml"]);

export function isMinimumPublicPath(pathname: string): boolean {
  return (
    AUTH_PATHS.has(pathname) ||
    INDEXING_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export function requiresPrivateSiteGate(pathname: string): boolean {
  return !isMinimumPublicPath(pathname);
}
