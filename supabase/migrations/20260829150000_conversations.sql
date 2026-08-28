-- ============================================================================
-- Acadify — conversations and their messages (Sprint 40, FR-C6)
--
-- The assistant has kept its history in React state since Sprint 37, which was
-- honest while it lasted: a reload started fresh and nothing claimed otherwise.
-- This is the persistence that claim was waiting for.
--
-- Two tables, not one. A conversation has a title, a scope and a life of its
-- own — it is renamed, resumed and deleted as a unit — while a message is
-- immutable once written. Folding them together would mean either a title
-- repeated on every row or a message row that can be renamed.
-- ============================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  /* The scope the conversation was started in, so resuming it restores what
     "my material" meant at the time. Nullable: "all my subjects" is a real
     answer, not a missing one.

     `on delete set null` rather than cascade — deleting a subject must not
     silently delete the conversations about it. The thread survives and simply
     stops being scoped, which is recoverable; the alternative loses work a
     student never asked to lose. */
  subject_id uuid references public.subjects (id) on delete set null,

  /* Seeded from the first question and editable. 300 matches `materials.title`
     so the two are consistent wherever a name is shown. */
  title text not null check (char_length(title) between 1 and 300),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,

  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 100000),

  /* Citations as JSON rather than a third table.
     They are written once with the message, read only with the message, and
     never queried across messages — a join table would buy nothing and cost a
     migration every time a citation gains a field. The shape is
     `[{ materialId, materialName, page }]`. */
  citations jsonb not null default '[]'::jsonb,

  /* An answer given from general knowledge after the student opted in (FR-C3).
     Stored so a resumed conversation still shows the warning it was given with
     — an answer that looked ungrounded yesterday must not look grounded
     today. */
  ungrounded boolean not null default false,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Composite ownership, the same closure as Sprint 14
--
-- A plain `conversation_id` foreign key lets a row point at a conversation
-- belonging to somebody else — RLS would hide the result, but the row would
-- exist. Referencing `(id, user_id)` makes that unrepresentable rather than
-- merely invisible.
-- ---------------------------------------------------------------------------
alter table public.conversations
  add constraint conversations_id_user_key unique (id, user_id);

alter table public.conversation_messages
  drop constraint if exists conversation_messages_conversation_id_fkey;

alter table public.conversation_messages
  add constraint conversation_messages_conversation_fkey
  foreign key (conversation_id, user_id)
  references public.conversations (id, user_id) on delete cascade;

-- Same treatment for the subject scope.
alter table public.conversations
  drop constraint if exists conversations_subject_id_fkey;

alter table public.conversations
  add constraint conversations_subject_fkey
  foreign key (subject_id, user_id)
  references public.subjects (id, user_id) on delete set null (subject_id);

-- ---------------------------------------------------------------------------
-- Indexes
--
-- The list is "my conversations, most recent first", so that is the index.
-- Messages are always read as a whole conversation in order, so that is theirs.
-- ---------------------------------------------------------------------------
create index if not exists conversations_recent_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists conversation_messages_thread_idx
  on public.conversation_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled with policies in the same migration, unlike Sprint 13 where the two
-- were split. That split was defensible when seventeen tables landed at once
-- and the policies needed their own review; for two tables, a window where RLS
-- is on and nothing is permitted is a window where the feature is broken.
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['conversations', 'conversation_messages'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t || '_select_own', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t || '_insert_own', t);

    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t || '_update_own', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- A rename or a new message moves the thread to the top of the list.
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();
