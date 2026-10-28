create table event_lineups (
  event_id uuid not null references events (id) on delete cascade,
  slot int not null check (slot between 0 and 30),
  player_id uuid not null references players (id) on delete cascade,
  primary key (event_id, slot),
  unique (event_id, player_id)
);
alter table event_lineups enable row level security;
create policy event_lineups_select on event_lineups for select using (can_manage_team(event_team(event_id)));
grant select on event_lineups to authenticated;
