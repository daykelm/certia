/**
 * API configuration from environment variables.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  logLevel: process.env.LOG_LEVEL ?? "info",
  /**
   * Public base URL of the app. Used to build links sent to users
   * (e.g. the beneficiary upload portal, F-06). Production: https://app.certia-es.com
   */
  publicUrl: (process.env.PUBLIC_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  /** Folder with the built frontend; when set and present, the API serves it. */
  webDir: process.env.WEB_DIR,
  /** Development only: identity used for every request until Google sign-in exists (F-01). */
  devUserEmail: process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : undefined,
};

export type Config = typeof config;
