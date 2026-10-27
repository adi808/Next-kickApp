-- Reconstructed: these were created on the live project by hand, outside a migration, before 0010b.
-- Already in effect on the live project; do not apply there again.

create function delete_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not can_manage_team(event_team(p_event)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from events where id = p_event;
end $$;

create function delete_stat(p_stat uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  perform require_auth();
  select event_id into v_event from event_stats where id = p_stat;
  if v_event is null or not can_manage_team(event_team(v_event)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from event_stats where id = p_stat;
end $$;

create function delete_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not can_manage_team(task_team(p_task)) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from tasks where id = p_task;
end $$;

create function delete_survey(p_survey uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not can_manage_team(survey_team(p_survey)) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from surveys where id = p_survey;
end $$;

create function remove_player_from_team(p_team uuid, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_auth();
  if not can_manage_team(p_team) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from team_players where team_id = p_team and player_id = p_player;
end $$;

-- Replaces the caller's answers to the survey.
create function submit_survey(p_survey uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_auth(); v_team uuid := survey_team(p_survey); a jsonb; v_q survey_questions; v_opt text; v_closes timestamptz;
begin
  if v_team is null or not is_team_member(v_team) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select closes_at into v_closes from surveys where id = p_survey;
  if v_closes is not null and v_closes < now() then
    raise exception 'the survey is closed' using errcode = '22023';
  end if;
  delete from survey_answers where respondent_id = v_uid
     and question_id in (select id from survey_questions where survey_id = p_survey);
  for a in select * from jsonb_array_elements(p_answers) loop
    select * into v_q from survey_questions where id = (a ->> 'question_id')::uuid and survey_id = p_survey;
    if not found then raise exception 'unknown question' using errcode = '22023'; end if;
    if v_q.kind = 'text' then
      if coalesce(btrim(a ->> 'text'), '') <> '' then
        insert into survey_answers (question_id, respondent_id, text_answer) values (v_q.id, v_uid, a ->> 'text');
      end if;
    else
      if v_q.kind = 'single' and jsonb_array_length(coalesce(a -> 'option_ids', '[]')) > 1 then
        raise exception 'only one option allowed' using errcode = '22023';
      end if;
      for v_opt in select jsonb_array_elements_text(coalesce(a -> 'option_ids', '[]')) loop
        if not exists (select 1 from survey_options where id = v_opt::uuid and question_id = v_q.id) then
          raise exception 'unknown option' using errcode = '22023';
        end if;
        insert into survey_answers (question_id, respondent_id, option_id) values (v_q.id, v_uid, v_opt::uuid);
      end loop;
    end if;
  end loop;
end $$;

-- attribute_values.entity_id has no foreign key (it points at players, teams or events).
create function cleanup_attribute_values() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from attribute_values where entity_id = old.id;
  return old;
end $$;
create trigger players_cleanup_attrs after delete on players
  for each row execute function cleanup_attribute_values();
create trigger teams_cleanup_attrs after delete on teams
  for each row execute function cleanup_attribute_values();
create trigger events_cleanup_attrs after delete on events
  for each row execute function cleanup_attribute_values();
