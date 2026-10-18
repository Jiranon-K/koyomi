/* Overridable for the same reason as the main server's port in playwright.config.ts. */
export const LINE_SERVER_PORT = Number(process.env.E2E_LINE_PORT ?? 3101);
export const LINE_SERVER = `http://localhost:${LINE_SERVER_PORT}`;
export const LINE_SERVER_DIR = ".e2e/line";
export const LINE_E2E_SERVER = { origin: LINE_SERVER, dir: LINE_SERVER_DIR };
export const LINE_LOGIN_CHANNEL_ID = "1234567890";
