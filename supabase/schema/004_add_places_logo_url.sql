-- Nullable per-school emblem/logo image URL. Null falls back to a generic
-- placeholder icon in the UI (src/lib/placeholderLogo.ts) until real school
-- emblems are sourced and set per row.
alter table places add column logo_url text;
