#!/usr/bin/env node
// Entrypoint for cPanel's Node.js Selector (Passenger), which runs a single
// JS file directly rather than an npm script (`npm run start`). This just
// delegates to @react-router/serve's own CLI, pointing it at the built
// server bundle. The CLI already reads `process.env.PORT`, which cPanel
// injects automatically, so no extra wiring is needed for that.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.argv[2] = path.join(__dirname, "build", "server", "index.js");
// @react-router/serve's package.json "exports" field only allows importing
// "./package.json" from outside the package, so a bare
// "@react-router/serve/dist/cli.js" specifier is rejected. Requiring by
// filesystem path bypasses that (exports only gates bare-specifier subpath
// resolution, not direct file paths).
require(path.join(__dirname, "node_modules", "@react-router/serve", "dist", "cli.js"));
