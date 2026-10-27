create view team_people as
  select team_id, user_id as profile_id from memberships where team_id is not null
  union
  select tp.team_id, g.parent_id from team_players tp
    join guardianships g on g.player_id = tp.player_id and g.status = 'approved'
  union
  select tp.team_id, p.user_id from team_players tp
    join players p on p.id = tp.player_id where p.user_id is not null;
revoke all on team_people from authenticated, anon;

create function profile_visible(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select shares_club(p_other)
      or exists (select 1 from team_people a join team_people b on a.team_id = b.team_id
                 where a.profile_id = auth.uid() and b.profile_id = p_other)
      or exists (select 1 from team_people tp join teams t on t.id = tp.team_id
                 where tp.profile_id = p_other and is_club_admin(t.club_id))
      or exists (select 1 from guardianships g join players p on p.id = g.player_id
                 where (g.parent_id = auth.uid() and p.user_id = p_other)
                    or (p.user_id = auth.uid() and g.parent_id = p_other))
      or exists (select 1 from guardianships g
                 where g.status = 'pending' and g.parent_id = p_other and coaches_player(g.player_id))
$$;

create policy profiles_select on profiles for select using (
  id = auth.uid() or is_system_admin() or profile_visible(id));

create view v_players as
  select p.id, p.club_id, p.full_name,
         case when can_manage_player(p.id) or is_parent_of(p.id) or is_self_player(p.id)
              then p.birth_date end as birth_date,
         case when p.photo_consent or can_manage_player(p.id) or is_parent_of(p.id) or is_self_player(p.id)
              then p.photo_path end as photo_path,
         p.photo_consent,
         (p.user_id is not null) as has_account,
         (p.user_id = auth.uid()) as is_me
  from players p
  where can_view_player(p.id);
grant select on v_players to authenticated;

alter table team_players enable row level security;
create policy team_players_select on team_players for select using (is_team_member(team_id));

create policy guardianships_select on guardianships for select using (
  parent_id = auth.uid() or is_self_player(player_id)
  or coaches_player(player_id) or is_system_admin());

create policy messages_insert on messages for insert with check (
  author_id = auth.uid() and can_post_team(team_id));