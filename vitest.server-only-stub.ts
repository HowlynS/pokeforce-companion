// Vitest (unlike Next.js's webpack/Turbopack build) does not alias the
// real "server-only" package to a no-op when bundling for the server —
// its actual implementation unconditionally throws, since it assumes a
// bundler is doing that aliasing. This empty stub replaces it for the
// unit suite only, so a module that imports "server-only" for genuine
// client-bundle protection can still be unit-tested directly under Node.
export {};
