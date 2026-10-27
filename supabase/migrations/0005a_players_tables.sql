create table players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  birth_date date not null check (birth_date > date '1900-01-01' and birth_date <= current_date),
  photo_path text,
  photo_consent boolean not null default false,
  photo_consent_by uuid references profiles (id),
  photo_consent_at timestamptz,
  user_id uuid unique references profiles (id) on delete set null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index players_club_idx on players (club_id);

create table team_players (
  team_id uuid not null references teams (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, player_id)
);
create index team_players_player_idx on team_players (player_id);

create function team_players_same_club() returns trigger
language plpgsql as $$
begin
  if (select club_id from teams where id = new.team_id)
     is distinct from (select club_id from players where id = new.player_id) then
    raise exception 'player and team belong to different clubs' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger team_players_same_club before insert on team_players
  for each row execute function team_players_same_club();

alter table players enable row level security;
revoke all on players from authenticated, anon;