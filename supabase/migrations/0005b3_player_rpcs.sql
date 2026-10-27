create function link_player_phone(p_player uuid, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_auth();
  v_phone text := norm_phone(p_phone);
  v_target uuid;
  v_club uuid;
begin
  if v_phone is null then raise exception 'invalid phone' using errcode = '22023'; end if;
  if not (can_manage_player(p_player) or is_parent_of(p_player)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select club_id into v_club from players where id = p_player;
  select id into v_target from profiles where phone = v_phone;
  if v_target is not null then
    if exists (select 1 from players where user_id = v_target and id <> p_player) then
      raise exception 'this phone already belongs to another player' using errcode = '23505';
    end if;
    update players set user_id = v_target where id = p_player;
  else
    insert into invites (phone, club_id, role, invited_by, player_id)
    values (v_phone, v_club, 'player', v_uid, p_player);
  end if;
end $$;

create function invite_parent(p_player uuid, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_auth();
  v_phone text := norm_phone(p_phone);
  v_target uuid;
begin
  if v_phone is null then raise exception 'invalid phone' using errcode = '22023'; end if;
  if not can_manage_player(p_player) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select id into v_target from profiles where phone = v_phone;
  if v_target is not null then
    insert into guardianships (parent_id, player_id, requested_by, status, approved_by)
    values (v_target, p_player, v_uid, 'approved', v_uid)
    on conflict (parent_id, player_id) do update set status = 'approved', approved_by = v_uid;
  else
    insert into invites (phone, club_id, role, invited_by, player_id)
    select v_phone, club_id, 'parent', v_uid, p_player from players where id = p_player;
  end if;
end $$;

create function add_player(p_team uuid, p_full_name text, p_birth_date date,
                           p_phone text default null, p_parent_phone text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_auth(); v_club uuid; v_player uuid;
begin
  select club_id into v_club from teams where id = p_team;
  if v_club is null then raise exception 'team not found' using errcode = 'P0002'; end if;
  if not can_manage_team(p_team) then
    raise exception 'only the coach or club admin can add players' using errcode = '42501';
  end if;
  insert into players (club_id, full_name, birth_date, created_by)
  values (v_club, btrim(p_full_name), p_birth_date, v_uid) returning id into v_player;
  insert into team_players (team_id, player_id) values (p_team, v_player);
  if p_phone is not null and btrim(p_phone) <> '' then perform link_player_phone(v_player, p_phone); end if;
  if p_parent_phone is not null and btrim(p_parent_phone) <> '' then perform invite_parent(v_player, p_parent_phone); end if;
  return v_player;
end $$;

create function add_player_to_team(p_team uuid, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not can_manage_team(p_team) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into team_players (team_id, player_id) values (p_team, p_player) on conflict do nothing;
end $$;

create function update_player(p_player uuid, p_full_name text default null,
                              p_birth_date date default null, p_photo_path text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not (can_manage_player(p_player) or is_parent_of(p_player)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update players set
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    birth_date = coalesce(p_birth_date, birth_date),
    photo_path = coalesce(p_photo_path, photo_path)
  where id = p_player;
end $$;

create function set_photo_consent(p_player uuid, p_consent boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_auth();
begin
  if not is_parent_of(p_player) then
    raise exception 'only a parent can set photo consent' using errcode = '42501';
  end if;
  update players set photo_consent = p_consent,
         photo_consent_by = v_uid, photo_consent_at = now()
   where id = p_player;
end $$;