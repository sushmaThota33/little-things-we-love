-- ============================================================
-- Little Things We Love — multi-couple schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- USERS ----------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

create index if not exists users_email_idx on users (lower(email));

-- ---------- COUPLES ----------
create table if not exists couples (
  id               uuid primary key default gen_random_uuid(),
  name             text,
  created_by       uuid references users(id) on delete set null,
  -- E2E encryption: per-couple PBKDF2 salt and a verification blob
  -- (encrypt of a known plaintext with the derived key). Server cannot
  -- decrypt anything with these alone.
  encryption_salt  text,
  encryption_check text,
  created_at       timestamptz not null default now()
);

-- ---------- COUPLE MEMBERS ----------
create table if not exists couple_members (
  couple_id uuid not null references couples(id) on delete cascade,
  user_id   uuid not null references users(id)   on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create unique index if not exists couple_members_user_unique on couple_members (user_id);

-- Trigger: max 2 members per couple
create or replace function enforce_couple_size()
returns trigger
language plpgsql
as $func$
begin
  if (select count(*) from couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'Couple % already has 2 members', new.couple_id;
  end if;
  return new;
end;
$func$;

drop trigger if exists couple_members_size_check on couple_members;
create trigger couple_members_size_check
  before insert on couple_members
  for each row execute function enforce_couple_size();

-- ---------- INVITATIONS ----------
create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couples(id) on delete cascade,
  invited_by  uuid references users(id) on delete set null,
  token       text unique not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists invitations_couple_idx on invitations (couple_id);

-- ---------- ENTRIES (notes) ----------
create table if not exists entries_couples (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references couples(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  text            text not null,
  written_month   text not null,
  unlock_date     date not null,
  month_unlocked  boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists entries_couple_idx       on entries_couples (couple_id);
create index if not exists entries_couple_month_idx on entries_couples (couple_id, written_month);

alter table users          enable row level security;
alter table couples        enable row level security;
alter table couple_members enable row level security;
alter table invitations    enable row level security;
alter table entries_couples enable row level security;