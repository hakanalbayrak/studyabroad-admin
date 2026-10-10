-- Run this on cPanel phpMyAdmin or MySQL CLI to add ranking columns
ALTER TABLE entities
  ADD COLUMN qs_rank        INT  NULL AFTER description_json,
  ADD COLUMN qs_rank_year   YEAR NULL AFTER qs_rank,
  ADD COLUMN the_rank       INT  NULL AFTER qs_rank_year,
  ADD COLUMN the_rank_year  YEAR NULL AFTER the_rank,
  ADD COLUMN leiden_rank    INT  NULL AFTER the_rank_year,
  ADD COLUMN leiden_rank_year YEAR NULL AFTER leiden_rank,
  ADD COLUMN shanghai_rank  INT  NULL AFTER leiden_rank_year,
  ADD COLUMN shanghai_rank_year YEAR NULL AFTER shanghai_rank;
