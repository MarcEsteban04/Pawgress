/**
 * Environment access for Pawgress.
 *
 * Read every environment variable through this module instead of touching
 * `process.env` directly, so a missing value fails loudly at the boundary
 * rather than silently becoming `undefined` deep inside a feature.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when it is
 * referenced as a full static expression — never destructure `process.env`,
 * and never build a variable name dynamically.
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

function present(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/**
 * Supabase renamed its keys in 2025: `anon` became the *publishable* key and
 * `service_role` became the *secret* key. Both naming schemes are in the wild —
 * a project created last year hands you one set, a project created today the
 * other — so both are accepted and the newer name wins where both are set.
 * The alternative is a confusing "missing key" error while the key is sitting
 * right there in `.env.local` under its other name.
 */
const supabaseUrl = present(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey =
  present(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
  present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Values safe to reference in client components. */
export const publicEnv = {
  appUrl: optional(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),
  appName: optional(process.env.NEXT_PUBLIC_APP_NAME, "Pawgress"),

  /** Undefined until a Supabase project is wired up — see `supabaseConfigured`. */
  supabaseUrl,
  supabaseAnonKey,
} as const;

/**
 * Whether a Supabase project is wired up.
 *
 * Auth, storage and the database all key off this rather than off a feature
 * flag, because a flag is something a person can forget to flip. Configuration
 * cannot be forgotten: production either has the URL and key or it does not,
 * and the code below fails closed when it does not.
 */
export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * The same values, but as a hard requirement. Call this from code that cannot
 * work without Supabase — the client factories — so the failure names the
 * variable instead of surfacing as a fetch to `undefined/auth/v1/token`.
 */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  return {
    url: required(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

/**
 * Server-only values. Importing this from a client component is a bug —
 * these must never reach the browser bundle. Each is a getter so that merely
 * importing the module does not throw for a key this request never needed.
 */
export const serverEnv = {
  /** Bypasses Row Level Security. Only for migrations and trusted server jobs. */
  get supabaseSecretKey() {
    const key =
      present(process.env.SUPABASE_SECRET_KEY) ?? present(process.env.SUPABASE_SERVICE_ROLE_KEY);
    return required(key, "SUPABASE_SECRET_KEY");
  },
  get anthropicApiKey() {
    return required(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
  },
} as const;

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";
