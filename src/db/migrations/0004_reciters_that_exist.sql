-- Repoints stored preferences at reciters that still ship.
--
-- Alijon Qori was offered at onboarding before anything played, and is on no
-- per-verse CDN and no surah CDN reachable from here — so the name was removed.
-- The application already falls back when it meets an unknown id, but a stored
-- preference that can never be honoured is a lie in the database, and the next
-- person to read the column would have to rediscover why.
--
-- Minshawi and Badr al-Turki are left alone: both play.
update profiles
set preferred_reciter = 'alafasy', updated_at = now()
where preferred_reciter not in ('alafasy', 'husary', 'minshawi', 'badr');
