insert into lookups (domain, slug, name_he, sort_order) values
  ('staff_role', 'head_coach', 'מאמן ראשי', 1),
  ('staff_role', 'assistant_coach', 'עוזר מאמן', 2),
  ('staff_role', 'fitness_coach', 'מנהל כושר', 3),
  ('staff_role', 'secretary', 'מזכירה', 4),
  ('staff_role', 'medic', 'חובש', 5);

alter table memberships add column staff_role_id uuid references lookups (id);

create function set_staff_role(p_membership uuid, p_role uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  perform require_auth();
  select * into m from memberships where id = p_membership;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not (is_club_admin(m.club_id) or (m.team_id is not null and is_team_coach(m.team_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role is not null and not lookup_in_domain(p_role, 'staff_role') then
    raise exception 'unknown staff type' using errcode = '22023';
  end if;
  update memberships set staff_role_id = p_role where id = p_membership;
end $$;

create function team_staff(p_team uuid)
returns table (membership_id uuid, user_id uuid, full_name text, avatar_path text, staff_role_id uuid)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, coalesce(nullif(pr.full_name, ''), pr.email, ''), pr.avatar_path, m.staff_role_id
    from memberships m join profiles pr on pr.id = m.user_id
    left join lookups l on l.id = m.staff_role_id
   where m.team_id = p_team and m.role = 'coach' and is_team_member(p_team)
   order by coalesce(l.sort_order, 99), 3
$$;

insert into attribute_defs (scope, key, label_he, data_type, config, visible_to, editable_by, sort_order) values
  ('team', 'league_url', 'קישור לדף הקבוצה באתר ההתאחדות (טבלת ליגה)', 'text', '{"placeholder": "https://www.football.org.il/team-details/?team_id=...&season_id=..."}',
   array['system_admin','club_admin','coach','parent','player'], array['system_admin','club_admin','coach'], 5);

revoke execute on function set_staff_role(uuid, uuid), team_staff(uuid) from public, anon;
grant execute on function set_staff_role(uuid, uuid), team_staff(uuid) to authenticated;
