// Vercel serverless entry. An Express app is a plain (req, res) handler, so it
// can be exported directly -- see vercel.json for the /api/* rewrite.
import { createApp } from "../server/app.js";

export default createApp();
