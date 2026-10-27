alter table guardianships add column player_id uuid not null references players (id) on delete cascade;
alter table guardianships add unique (parent_id, player_id);

alter table invites add column player_id uuid references players (id) on delete cascade;
alter table invites add check (
  (role = 'club_admin' and team_id is null and player_id is null)
  or (role = 'coach' and team_id is not null)
  or (role in ('player', 'parent') and player_id is not null));

create function is_club_admin_strict(p_club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                 where user_id = auth.uid() and club_id = p_club and role = 'club_admin')
$$;

create function can_manage_team(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_team_coach(p_team)
      or is_club_admin((select club_id from teams where id = p_team))
$$;

create function is_parent_of(p_player uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardianships
                 where parent_id = auth.uid() and player_id = p_player and status = 'approved')
$$;

create function is_self_player(p_player uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where id = p_player and user_id = auth.uid())
$$;

create function coaches_player(p_player uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_players tp join memberships m on m.team_id = tp.team_id
    where tp.player_id = p_player and m.user_id = auth.uid() and m.role = 'coach')
$$;

create function can_manage_player(p_player uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_system_admin()
      or coaches_player(p_player)
      or is_club_admin((select club_id from players where id = p_player))
$$;

create function is_team_parent(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_players tp join guardianships g on g.player_id = tp.player_id
                 where tp.team_id = p_team and g.parent_id = auth.uid() and g.status = 'approved')
$$;

create function is_team_player(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_players tp join players p on p.id = tp.player_id
                 where tp.team_id = p_team and p.user_id = auth.uid())
$$;

create function can_post_team(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_team(p_team) or is_team_parent(p_team)
$$;

create function can_view_player(p_player uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_player(p_player) or is_parent_of(p_player) or is_self_player(p_player)
      or exists (select 1 from team_players tp
                 where tp.player_id = p_player and is_team_member(tp.team_id))
$$;

create function player_age(p_player uuid) returns int
language sql stable security definer set search_path = public as $$
  select extract(year from age(birth_date))::int from players where id = p_player
$$;