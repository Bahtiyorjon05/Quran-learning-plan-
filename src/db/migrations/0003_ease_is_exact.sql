-- Ease was `real`, and `real` cannot hold 1.3.
--
-- The scheduler clamps ease to the floor of 1.3 after repeated lapses. Postgres
-- stores that in float4 as 1.2999999523162842, and the column's own CHECK
-- (`ease between 1.3 and 3.0`) then rejects the row it just rounded:
--
--   select 1.3::real >= 1.3;  -- false
--
-- So a reciter who kept forgetting a page eventually reached a state where
-- every further review failed to save, permanently, with a constraint error.
-- Numeric is exact, and two decimal places is all ease ever has.
alter table memorization_units
  alter column ease type numeric(3, 2) using round(ease::numeric, 2);

-- Any row already stored just under the floor is brought back onto it.
update memorization_units set ease = 1.30 where ease < 1.30;
update memorization_units set ease = 3.00 where ease > 3.00;
