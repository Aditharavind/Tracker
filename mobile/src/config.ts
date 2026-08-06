// Point this at the FastAPI dev server (see backend/app/coach/router.py).
// `localhost` only resolves inside the iOS simulator. A physical device or
// the Android emulator needs your machine's LAN IP -- on the Android
// emulator specifically, 10.0.2.2 maps back to the host's localhost.
export const API_BASE_URL = "http://localhost:8000";
