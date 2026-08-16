// Runs the API and Vite together, on every OS, with no extra dependency.
// Ctrl-C kills both.
import { spawn } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const procs = [
  spawn(process.execPath, ["--env-file-if-exists=.env.local", "scripts/api-server.js"], {
    stdio: "inherit",
  }),
  spawn(npx, ["vite"], { stdio: "inherit" }),
];

const stop = () => procs.forEach((p) => !p.killed && p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => { stop(); process.exit(code ?? 0); }));
