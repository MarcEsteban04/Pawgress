/**
 * Environment access for Pawgress.
 *
 * Read every environment variable through this module instead of touching
 * `process.env` directly, so a missing value fails loudly at the boundary
 * rather than silently becoming `undefined` deep inside a feature.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when it is
 * referenced as a full static expression — never destructure `process.env`.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`);
  }
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

/** Values safe to reference in client components. */
export const publicEnv = {
  appUrl: optional(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),
  appName: optional(process.env.NEXT_PUBLIC_APP_NAME, "Pawgress"),
} as const;

/**
 * Server-only values. Importing this from a client component is a bug —
 * these must never reach the browser bundle.
 */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  },
  get anthropicApiKey() {
    return required(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
  },
} as const;

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";
