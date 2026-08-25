/**
 * Generated database types.
 *
 * This file is REGENERATED, not hand-edited:
 *
 * ```bash
 * npm run db:types          # against the local stack
 * npm run db:types:remote   # against the linked hosted project
 * ```
 *
 * It is a placeholder until Sprint 13 creates the schema. The shape below is
 * what `supabase gen types typescript` emits for an empty `public` schema, so
 * the clients are already generic over the real type and the first generation
 * is a drop-in replacement rather than a refactor.
 *
 * Committed rather than gitignored on purpose: a typecheck must not depend on
 * a database being reachable.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
