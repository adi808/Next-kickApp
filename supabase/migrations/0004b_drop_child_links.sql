-- Reconstructed: these were run on the live project by hand, outside a migration, before 0005.
-- Guardianships move from profile-to-profile (child_id) to profile-to-player (player_id, added in 0005b1);
-- the policies that referenced child_id are recreated in 0005b2.
-- Already in effect on the live project; do not apply there again.

drop policy guardianships_select on guardianships;
drop policy profiles_select on profiles;
drop policy messages_insert on messages;
drop function coaches_child(uuid);
alter table guardianships drop column child_id;
-- 0005b1 replaces the invites check so players and parents can be invited without a team.
alter table invites drop constraint invites_check;
