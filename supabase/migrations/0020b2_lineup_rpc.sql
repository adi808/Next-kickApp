-- Reconstructed: created on the live project by hand, outside a migration, after 0020b1.
-- Already in effect on the live project; do not apply there again.

-- Replaces an event's lineup: p_players[i] goes in slot i - 1, null leaves a slot empty.
create function set_event_lineup(p_event uuid, p_players uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_team uuid := event_team(p_event);
begin
  perform require_auth();
  if v_team is null or not can_manage_team(v_team) then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(cardinality(p_players), 0) > 31 then raise exception 'too many slots' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_players, '{}')) p
             where p is not null and not exists (select 1 from team_players where team_id = v_team and player_id = p)) then
    raise exception 'player is not on this team' using errcode = '22023';
  end if;
  delete from event_lineups where event_id = p_event;
  insert into event_lineups (event_id, slot, player_id)
  select p_event, i - 1, p_players[i] from generate_subscripts(coalesce(p_players, '{}'), 1) i
   where p_players[i] is not null;
end $$;

revoke execute on function set_event_lineup(uuid, uuid[]) from public, anon;
grant execute on function set_event_lineup(uuid, uuid[]) to authenticated;
