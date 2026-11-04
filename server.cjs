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

// A webhook's background send (order confirmation, shipped, etc.) runs after
// the HTTP response is already sent; if the process is killed mid-send by a
// restart (deploy, crash, manual `pm2 restart`), that notification is left
// stuck at "pending" forever with no way to know it failed. This can't be
// prevented outright -- any restart during active traffic has this risk --
// but it shouldn't sit invisible: anything still "pending" from before this
// boot clearly didn't finish, so mark it "failed" with a clear reason rather
// than leaving it ambiguous. This is not a retry (we don't have enough
// context left to safely resend), just making the failure visible.
(async () => {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const { count } = await prisma.notificationLog.updateMany({
      where: { status: "pending", createdAt: { lt: staleBefore } },
      data: { status: "failed", errorMessage: "interrupted_by_restart" },
    });
    if (count > 0) {
      console.warn(`[order-ping] startup reconciliation: marked ${count} notification(s) stuck pending from before this restart as failed`);
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error("[order-ping] startup reconciliation failed", err);
  }
})();
// @react-router/serve's package.json "exports" field only allows importing
// "./package.json" from outside the package, so a bare
// "@react-router/serve/dist/cli.js" specifier is rejected. Requiring by
// filesystem path bypasses that (exports only gates bare-specifier subpath
// resolution, not direct file paths).
require(path.join(__dirname, "node_modules", "@react-router/serve", "dist", "cli.js"));
