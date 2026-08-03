# Source preservation note

`project-archive/` is an exact recursive copy of the user-identified Claude
Design **First Iteration** project archive as received on 2026-08-03.

- 38 files
- 23,194,771 bytes
- source and checkpoint SHA-256 inventories compared equal after copying
- no file was renamed, normalized, reformatted, recompressed, or removed
- no dependency, cache, credential, or build-output directory was present

The five `.dc.html` files include Claude Design templates, embedded static
data, and `DCLogic` behavior. They depend on the bundled `support.js`, which in
turn references browser-hosted React, ReactDOM, and Babel. They are archival
design documents and rendering inputs, not production application source.
