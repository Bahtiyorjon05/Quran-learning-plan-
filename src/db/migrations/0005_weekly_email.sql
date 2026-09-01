-- The weekly report, and the switch that turns it off.
--
-- On by default: it reports on a promise the reader made to themselves, which
-- is the one message a hifz application has standing to send unasked. Every
-- copy of it carries the way to stop it, and this column is where that lands.
alter table profiles
  add column if not exists weekly_email boolean not null default true;
