#!/usr/bin/env node
// Entrypoint for cPanel's Node.js Selector (Passenger), which runs a single
// JS file directly rather than an npm script (`npm run start`). This just
// delegates to @react-router/serve's own CLI, pointing it at the built
// server bundle. The CLI already reads `process.env.PORT`, which cPanel
// injects automatically, so no extra wiring is needed for that.
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.argv[2] = require("path").join(__dirname, "build", "server", "index.js");
require("@react-router/serve/dist/cli.js");
