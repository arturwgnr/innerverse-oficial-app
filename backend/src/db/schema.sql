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
  mode text not null check (mode in ('full', 'fast', 'mindfulness')),
  language text not null check (language in ('en', 'pt')),
  prompt text,
  text_content text,
  audio_url text,
  mood smallint check (mood between 1 and 6),
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

-- Idempotent widen for an existing table (EDITS.md round 2 #3): 'mindfulness'
-- added as its own mode, a post-meditation reflection is distinct from a
-- regular full entry, the AI needs to know that's what it's reading.
do $$
begin
  alter table entries drop constraint if exists entries_mode_check;
  alter table entries add constraint entries_mode_check
    check (mode in ('full', 'fast', 'mindfulness'));
end $$;

-- Lets the Analysis page tell "still working on it" and "the model failed"
-- apart from "never attempted" instead of showing the same empty state for
-- all three (UPDATES.md #5). 'skipped' covers the two non-failure reasons
-- a row never gets attempted: no GEMINI_API_KEY configured, or the
-- daily free analysis cap was already reached for that entry.
alter table entries add column if not exists analysis_status text not null default 'pending'
  check (analysis_status in ('pending', 'ready', 'skipped', 'failed'));

-- 'processing' added (UPDATES.md round 4 #4, duplicate-analysis bug fix): the
-- background job used to only bump updated_at while claiming an entry,
-- leaving analysis_status itself at 'pending' for the whole Gemini call. A
-- slow call (rate-limit retry) could still be 'pending' past the recovery
-- sweep's 2 minute staleness window, so the sweep would "reclaim" and
-- generate a second analysis for the same entry. Claiming now flips status
-- to 'processing' immediately, so a second claim attempt sees a non-pending
-- row and backs off instead of racing the first one.
do $$
begin
  alter table entries drop constraint if exists entries_analysis_status_check;
  alter table entries add constraint entries_analysis_status_check
    check (analysis_status in ('pending', 'processing', 'ready', 'skipped', 'failed'));
end $$;

-- Mood taxonomy (UPDATES.md round 3 #2): moved from six unordered poetic
-- labels (radiant/steady/tender/restless/heavy/numb, deliberately no order)
-- to an ordered 1-6 thermostatic scale (1 worst, 6 best). Weather-register
-- display labels (Storming/Overcast/Clouded/Clearing/Bright/Radiant) live in
-- the frontend locale files, not here, this column is just the ordered
-- integer. One-time data migration for existing rows below, a judgment-call
-- mapping from the old set onto the new ordered scale: heavy (Down) -> 1,
-- tender (Hurt) -> 2, numb (Distant) -> 3, restless (Tense) -> 4, steady
-- (Calm) -> 5, radiant (Energized) -> 6 (kept as the top anchor, the one
-- name both taxonomies use for "the best it gets").
-- Dropped before the type change, not after: the old constraint stays
-- attached to the column mid-ALTER otherwise, and Postgres re-validates it
-- against the already-converted smallint values ("operator does not exist:
-- smallint = text"), even for a USING clause that never references it.
alter table entries drop constraint if exists entries_mood_check;

do $$
begin
  if (select data_type from information_schema.columns where table_name = 'entries' and column_name = 'mood') = 'text' then
    alter table entries alter column mood type smallint using (
      case mood
        when 'heavy' then 1
        when 'tender' then 2
        when 'numb' then 3
        when 'restless' then 4
        when 'steady' then 5
        when 'radiant' then 6
      end
    );
  end if;
end $$;

alter table entries add constraint entries_mood_check check (mood is null or mood between 1 and 6);

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

-- Timestamp of the latest About Me generation, kept separate from the
-- insights rows themselves (their generated_at stays as-is forever, they
-- are never deleted, so corrections tied to older rows survive). The About
-- Me route treats the cache as stale as soon as an entry is written after
-- this, instead of the old fixed 7 day window that froze the page after
-- the very first generation (UPDATES.md #6).
alter table living_profiles add column if not exists about_me_generated_at timestamptz;

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

-- Deep, per-entry analysis (replaces the old cross-entry Patterns concept
-- entirely). One row per entry that gets analyzed, its observations are
-- their own insights rows below so each can carry its own correction
-- verdict, exactly like the old pattern cards did.
create table if not exists entry_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists entry_analyses_user_created_idx on entry_analyses (user_id, created_at desc);

-- Backfill for analysis_status (added right after the analysis_status
-- column definition above), relocated to here because it reads from
-- entry_analyses, which does not exist yet at that earlier point in a
-- fresh database. Order matters for a top-to-bottom run against a new
-- database even though every statement above is individually idempotent.
-- One time backfill for rows that predate this column: without it, every
-- pre-existing entry defaults to 'pending' and would show as "still
-- analyzing" forever on the Analysis page, since no background job ever
-- revisits an old entry. Anything with a real entry_analyses row is 'ready'
-- (the query on the next line joins to insights, not this new column, so
-- this is purely cosmetic for those). Anything else old enough to not
-- plausibly still be mid flight (10 minutes is generous) goes to 'skipped',
-- same silent treatment as a live skip, rather than a misleading 'pending'.
update entries e set analysis_status = 'ready'
  where e.analysis_status = 'pending' and exists (select 1 from entry_analyses ea where ea.entry_id = e.id);

update entries e set analysis_status = 'skipped'
  where e.analysis_status = 'pending'
    and e.created_at < now() - interval '10 minutes'
    and not exists (select 1 from entry_analyses ea where ea.entry_id = e.id);


-- Insights cover per-entry analysis observations and About Me light/dark
-- understandings, anything the clean mirror principle can be corrected on.
-- 'pattern_summary'/'pattern_card' stay accepted for any historical rows
-- from before the Patterns-to-Analysis rework, nothing new writes them.
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('pattern_summary', 'pattern_card', 'about_me_light', 'about_me_dark', 'entry_analysis_observation')),
  category text,
  title text,
  body text not null,
  confidence text check (confidence in ('low', 'medium', 'high')),
  supporting_entry_count integer,
  generated_at timestamptz not null default now()
);

-- Idempotent widen of a pre-existing constraint, needed because this table
-- (and its check) already existed before entry_analysis_observation was added.
do $$
begin
  alter table insights drop constraint if exists insights_kind_check;
  alter table insights add constraint insights_kind_check
    check (kind in ('pattern_summary', 'pattern_card', 'about_me_light', 'about_me_dark', 'entry_analysis_observation'));
end $$;

alter table insights add column if not exists entry_id uuid references entries(id) on delete cascade;
alter table insights add column if not exists analysis_id uuid references entry_analyses(id) on delete cascade;
alter table insights add column if not exists position integer not null default 0;

create index if not exists insights_user_kind_idx on insights (user_id, kind, generated_at desc);
create index if not exists insights_analysis_idx on insights (analysis_id, position);

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

-- Preferred name/nickname (UPDATES.md round 3 #2, founder-requested exception
-- to the "no new onboarding questions beyond the prototype" rule, see
-- CLAUDE.md). Used throughout the app for a more personal feel (greetings,
-- Oracle copy), mandatory like birth_date rather than left to degrade to a
-- generic fallback everywhere it's used.
alter table onboarding_responses add column if not exists preferred_name text;
update onboarding_responses set preferred_name = 'there' where preferred_name is null;
alter table onboarding_responses alter column preferred_name set not null;

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
  mood smallint not null check (mood between 1 and 6),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Same 1-6 mood taxonomy migration as entries.mood above, same mapping and
-- same "drop the old constraint before the type change" ordering.
alter table day_mood_overrides drop constraint if exists day_mood_overrides_mood_check;

do $$
begin
  if (select data_type from information_schema.columns where table_name = 'day_mood_overrides' and column_name = 'mood') = 'text' then
    alter table day_mood_overrides alter column mood type smallint using (
      case mood
        when 'heavy' then 1
        when 'tender' then 2
        when 'numb' then 3
        when 'restless' then 4
        when 'steady' then 5
        when 'radiant' then 6
      end
    );
  end if;
end $$;

alter table day_mood_overrides add constraint day_mood_overrides_mood_check check (mood between 1 and 6);

-- Fast mode's reason picker (UPDATES.md round 3 #5): replaces the free-text
-- "quick notes" field with selectable keywords for what contributed to the
-- mood. The small default set (~4, kept generic) lives in the frontend/
-- locale files, not here, this table only holds what a user has added
-- themselves, so it persists for reuse on every future fast-mode entry.
create table if not exists reason_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

-- Broadcast "what's new" notifications (topbar bell icon): global, not
-- per-user, hand-authored for now (directly in the database or a future
-- admin route, no authoring UI yet). created_at doubles as the "shipped on"
-- date shown in the bell panel. notification_reads tracks per-user read
-- state separately so the same broadcast row is shared by everyone.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_idx on notifications (created_at desc);

create table if not exists notification_reads (
  user_id text not null references "user"(id) on delete cascade,
  notification_id uuid not null references notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

-- One example notification so the bell has something to show before real
-- content gets authored (user asked for a placeholder to adjust later).
-- Guarded on the table being empty rather than a fixed id, so it only ever
-- seeds once and never reappears after being deleted.
insert into notifications (title, body)
select
  'Welcome to What''s New',
  'This is where you''ll hear about updates to Innerverse, new features and fixes, each one dated so you can see exactly when it shipped.'
where not exists (select 1 from notifications);
