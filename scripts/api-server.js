// Local API server for the Vercel-compatible backend. In production this
// same app runs as a Vercel function (see api/index.js). Not wired into the
// default WSL dev.sh workflow, which still runs the Python/FastAPI backend
// on port 8000 -- start this on a different port to test the Vercel path.
import { createApp } from "../server/app.js";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`[75hard] vercel-compatible api on http://localhost:${port}`);
});
