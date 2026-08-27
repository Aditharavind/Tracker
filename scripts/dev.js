// Runs the API and Vite together, on every OS, with no extra dependency.
// Ctrl-C kills both.
import { spawn } from "node:child_process";

// Node >=20 refuses to spawn a Windows .cmd/.bat shim (npx.cmd) without
// shell:true -- it throws EINVAL. shell:true routes the command through
// cmd.exe, which resolves `npx` on its own; the args here are fixed literals
// so there is nothing to quote-escape.
const win = process.platform === "win32";

const procs = [
  spawn(process.execPath, ["--env-file-if-exists=.env.local", "scripts/api-server.js"], {
    stdio: "inherit",
  }),
  spawn("npx", ["vite"], { stdio: "inherit", shell: win }),
];

const stop = () => procs.forEach((p) => !p.killed && p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => { stop(); process.exit(code ?? 0); }));
