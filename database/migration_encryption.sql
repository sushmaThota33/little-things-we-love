-- ============================================================
-- Migration: add end-to-end encryption to existing install
-- Run this once in the Supabase SQL editor.
-- ============================================================
--
-- This wipes existing couples, members, invitations, and notes.
-- (We chose "wipe and start fresh" for the encryption rollout.)
-- Users keep their accounts; they just need to re-create their
-- couples and pick a diary passphrase.
-- ============================================================

truncate entries_couples cascade;
truncate invitations cascade;
truncate couple_members cascade;
truncate couples cascade;

alter table couples
  add column if not exists encryption_salt  text,
  add column if not exists encryption_check text;

-- Optional: enforce that new couples always have encryption set up
-- (uncomment if you want the DB to reject legacy non-encrypted couples)
-- alter table couples alter column encryption_salt  set not null;
-- alter table couples alter column encryption_check set not null;
