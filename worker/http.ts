/** An error whose (Thai) message is shown to the user as-is. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Bookings are also pulled from the Jaew Logbook app. Empty = turned off. */
  LOGBOOK_URL?: string;
  /** Cloudflare secret: signs the admin login tokens. */
  TOKEN_SECRET?: string;
  /** Cloudflare secret: key mixed into the saved PIN hash. */
  PIN_PEPPER?: string;
  /** Cloudflare secret, only set while moving data in (see scripts/import-railway-backup.mjs). */
  IMPORT_TOKEN?: string;
}
