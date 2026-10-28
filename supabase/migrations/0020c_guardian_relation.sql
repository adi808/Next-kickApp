insert into lookups (domain, slug, name_he, sort_order) values
  ('guardian_relation', 'mother', 'אמא', 1),
  ('guardian_relation', 'father', 'אבא', 2),
  ('guardian_relation', 'guardian', 'אפוטרופוס', 3);

alter table guardianships add column relation_id uuid references lookups (id);

create function set_guardian_relation(p_player uuid, p_parent uuid, p_relation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_auth(); v_id uuid;
begin
  if not ((p_parent = v_uid and is_parent_of(p_player)) or can_manage_player(p_player)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_relation is not null and not lookup_in_domain(p_relation, 'guardian_relation') then
    raise exception 'unknown relation' using errcode = '22023';
  end if;
  update guardianships set relation_id = p_relation
   where player_id = p_player and parent_id = p_parent and status = 'approved'
  returning id into v_id;
  if v_id is null then raise exception 'no such parent' using errcode = 'P0002'; end if;
end $$;

create function player_guardians(p_player uuid)
returns table (parent_id uuid, full_name text, avatar_path text, relation_id uuid)
language sql stable security definer set search_path = public as $$
  select g.parent_id, coalesce(nullif(pr.full_name, ''), pr.email, ''), pr.avatar_path, g.relation_id
    from guardianships g join profiles pr on pr.id = g.parent_id
   where g.player_id = p_player and g.status = 'approved'
     and (can_manage_player(p_player) or is_parent_of(p_player) or is_self_player(p_player))
   order by 2
$$;

revoke execute on function set_guardian_relation(uuid, uuid, uuid), player_guardians(uuid) from public, anon;
grant execute on function set_guardian_relation(uuid, uuid, uuid), player_guardians(uuid) to authenticated;
