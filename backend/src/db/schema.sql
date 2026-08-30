-- Innerverse domain schema.
-- Auth tables (user, session, account, verification) are owned by Better Auth
-- and generated separately, see package.json script "auth:generate" / "auth:migrate".
-- This file only covers the journaling/memory domain described in JOURNAL.md section 6.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- Voyage AI embedding dimension (voyage-3, 1024 dims). Adjust if the model changes.
-- Entries are the immutable source of truth. Two timestamps per entry support
-- retroactive writing: occurred_at (when it happened) vs written_at (when it was recorded).
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  moment text not null check (moment in ('morning', 'afternoon', 'night', 'decompress')),
  mode text not null check (mode in ('full', 'fast')),
  language text not null check (language in ('en', 'pt')),
  prompt text,
  text_content text,
  audio_url text,
  mood text check (mood in ('radiant', 'steady', 'tender', 'restless', 'heavy', 'numb')),
  bullets jsonb,
  is_retroactive boolean not null default false,
  occurred_at timestamptz not null,
  written_at timestamptz not null default now(),
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_occurred_idx on entries (user_id, occurred_at desc);
create index if not exists entries_user_moment_idx on entries (user_id, moment);

-- Living profile: lean structured JSON (~2 to 3k tokens), merged incrementally per entry.
create table if not exists living_profiles (
  user_id text primary key references "user"(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- How much the app currently estimates it understands about this person
-- (About Me knowledge bar). Persisted so a cached About Me response (see
-- routes/aboutMe.js) can still report it without regenerating.
alter table living_profiles add column if not exists knowledge_pct integer not null default 0;

-- Hierarchical narrative summaries (weekly, monthly, and a rolling meta summary).
create table if not exists narrative_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month', 'meta')),
  period_start date,
  period_end date,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_type, period_start)
);

-- Insights cover Patterns cards, the Patterns opening summary, and About Me
-- light/dark understandings, anything the clean mirror principle can be corrected on.
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('pattern_summary', 'pattern_card', 'about_me_light', 'about_me_dark')),
  category text,
  title text,
  body text not null,
  confidence text check (confidence in ('low', 'medium', 'high')),
  supporting_entry_count integer,
  generated_at timestamptz not null default now()
);

create index if not exists insights_user_kind_idx on insights (user_id, kind, generated_at desc);

-- Corrections turn "That's not it" / "True" into their own record, linked back to
-- the insight and, when relevant, the entry that produced it. Feeds the next
-- profile merge and future analysis context.
create table if not exists corrections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  insight_id uuid references insights(id) on delete cascade,
  entry_id uuid references entries(id) on delete set null,
  verdict text not null check (verdict in ('confirmed', 'rejected')),
  user_note text,
  created_at timestamptz not null default now()
);

-- Onboarding answers feed the first living_profile record directly (not left as
-- unused raw text). birth_date is mandatory, never estimated.
create table if not exists onboarding_responses (
  user_id text primary key references "user"(id) on delete cascade,
  birth_date date not null,
  responses jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

-- Structural question changes always go through explicit user approval, never silently.
create table if not exists question_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  moment text not null check (moment in ('morning', 'afternoon', 'night', 'decompress')),
  proposed_questions jsonb not null,
  rationale text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'edited_accepted', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Active question set per moment, once a proposal has been accepted (or
-- edited then accepted). Empty/absent means the app still uses the generic
-- starting templates for that moment.
create table if not exists question_sets (
  user_id text not null references "user"(id) on delete cascade,
  moment text not null check (moment in ('morning', 'afternoon', 'night', 'decompress')),
  questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, moment)
);

-- Divergent day resolution: when a day's moods disagree strongly, the user
-- picks which mood represents the day (JOURNAL.md section 7). Persisted so
-- the calendar does not ask again on every visit.
create table if not exists day_mood_overrides (
  user_id text not null references "user"(id) on delete cascade,
  day date not null,
  mood text not null check (mood in ('radiant', 'steady', 'tender', 'restless', 'heavy', 'numb')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
