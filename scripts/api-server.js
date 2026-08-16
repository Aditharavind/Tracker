// Local API server. In production this same app runs as a Vercel function.
import { createApp } from "../server/app.js";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`[75hard] api on http://localhost:${port}`);
});
