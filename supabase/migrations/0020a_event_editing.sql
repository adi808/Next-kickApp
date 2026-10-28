create function save_event_details(p_event uuid, p_type uuid, p_title text, p_starts timestamptz,
  p_ends timestamptz default null, p_location text default '', p_notes text default '',
  p_opponent text default null, p_our_score int default null, p_their_score int default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not can_manage_team(event_team(p_event)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not lookup_in_domain(p_type, 'event_type') then raise exception 'unknown event type' using errcode = '22023'; end if;
  if p_starts is null then raise exception 'a start time is required' using errcode = '22023'; end if;
  if p_ends is not null and p_ends < p_starts then
    raise exception 'the end must be after the start' using errcode = '22023';
  end if;
  update events set type_id = p_type, title = coalesce(btrim(p_title), ''), starts_at = p_starts, ends_at = p_ends,
         location = coalesce(btrim(p_location), ''), notes = coalesce(p_notes, ''),
         opponent = nullif(btrim(p_opponent), ''), our_score = p_our_score, their_score = p_their_score
   where id = p_event;
end $$;
revoke execute on function save_event_details(uuid, uuid, text, timestamptz, timestamptz, text, text, text, int, int) from public, anon;
grant execute on function save_event_details(uuid, uuid, text, timestamptz, timestamptz, text, text, text, int, int) to authenticated;
