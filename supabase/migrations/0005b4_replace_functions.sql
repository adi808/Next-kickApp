create or replace function is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_system_admin()
      or exists (select 1 from memberships where user_id = auth.uid() and team_id = p_team)
      or is_club_admin_strict((select club_id from teams where id = p_team))
      or is_team_player(p_team)
      or is_team_parent(p_team)
$$;

create or replace function is_club_member(p_club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_system_admin()
      or exists (select 1 from memberships where user_id = auth.uid() and club_id = p_club)
      or exists (select 1 from players where user_id = auth.uid() and club_id = p_club)
      or exists (select 1 from guardianships g join players p on p.id = g.player_id
                 where g.parent_id = auth.uid() and g.status = 'approved' and p.club_id = p_club)
$$;

create or replace function claim_invites(p_user uuid, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare r invites;
begin
  for r in select * from invites where phone = p_phone and status = 'pending' loop
    if r.role in ('club_admin', 'coach') then
      insert into memberships (user_id, club_id, team_id, role)
      values (p_user, r.club_id, r.team_id, r.role) on conflict do nothing;
    elsif r.role = 'player' then
      update players set user_id = p_user
       where id = r.player_id and user_id is null
         and not exists (select 1 from players where user_id = p_user);
    elsif r.role = 'parent' then
      insert into guardianships (parent_id, player_id, requested_by, status, approved_by)
      values (p_user, r.player_id, r.invited_by, 'approved', r.invited_by)
      on conflict do nothing;
    end if;
    update invites set status = 'claimed' where id = r.id;
  end loop;
end $$;

create or replace function invite_by_phone(p_phone text, p_club uuid, p_team uuid, p_role app_role)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_auth();
  v_phone text := norm_phone(p_phone);
  v_target uuid;
  v_invite uuid;
begin
  if v_phone is null then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if p_role not in ('club_admin', 'coach') then
    raise exception 'use add_player / invite_parent for players and parents' using errcode = '22023';
  end if;
  if p_role = 'club_admin' and p_team is not null then
    raise exception 'club_admin has no team' using errcode = '22023';
  end if;
  if p_role = 'coach' and (p_team is null
      or not exists (select 1 from teams where id = p_team and club_id = p_club)) then
    raise exception 'team does not belong to club' using errcode = '22023';
  end if;
  if not is_club_admin(p_club) then
    raise exception 'only a club admin can invite staff' using errcode = '42501';
  end if;

  insert into invites (phone, club_id, team_id, role, invited_by)
  values (v_phone, p_club, p_team, p_role, v_uid) returning id into v_invite;

  select id into v_target from profiles where phone = v_phone;
  if v_target is not null then
    insert into memberships (user_id, club_id, team_id, role)
    values (v_target, p_club, p_team, p_role) on conflict do nothing;
    update invites set status = 'claimed' where id = v_invite;
  end if;
  return v_invite;
end $$;

create or replace function request_guardianship(p_other_phone text, p_as_parent boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_auth();
  v_other uuid;
  v_player uuid;
  v_parent uuid;
  v_id uuid;
begin
  select id into v_other from profiles where phone = norm_phone(p_other_phone);
  if v_other is null then raise exception 'no user with this phone' using errcode = 'P0002'; end if;
  if v_other = v_uid then raise exception 'cannot link to yourself' using errcode = '22023'; end if;
  if p_as_parent then
    v_parent := v_uid;
    select id into v_player from players where user_id = v_other;
  else
    v_parent := v_other;
    select id into v_player from players where user_id = v_uid;
  end if;
  if v_player is null then
    raise exception 'the player side has no player profile' using errcode = 'P0002';
  end if;
  insert into guardianships (parent_id, player_id, requested_by)
  values (v_parent, v_player, v_uid) returning id into v_id;
  return v_id;
end $$;

create or replace function respond_guardianship(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_auth(); v_player uuid;
begin
  select player_id into v_player from guardianships where id = p_id and status = 'pending';
  if v_player is null then raise exception 'no pending request' using errcode = 'P0002'; end if;
  if not coaches_player(v_player) then
    raise exception 'only the player''s coach can respond' using errcode = '42501';
  end if;
  update guardianships
     set status = case when p_approve then 'approved'::link_status else 'rejected'::link_status end,
         approved_by = v_uid
   where id = p_id;
end $$;