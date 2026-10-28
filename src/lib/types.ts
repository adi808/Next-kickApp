export type AppRole = 'club_admin' | 'coach' | 'player' | 'parent';

export interface Profile {
  id: string;
  phone: string | null;
  full_name: string;
  is_system_admin: boolean;
}

export interface Membership {
  id: string;
  club_id: string;
  team_id: string | null;
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  club_admin: 'מנהל מועדון',
  coach: 'מאמן',
  player: 'שחקן',
  parent: 'הורה',
};

export interface Sport {
  id: string;
  slug: string;
  name_he: string;
  icon_path: string;
  sort_order: number;
}

// One row of event_transport_list(): a player (seats include anyone travelling with them, 0 = no ride)
// or a staff member. The total is event_transport_total(), or the sum of these rows.
export interface TransportRow {
  player_id: string | null;
  profile_id: string | null;
  name: string;
  role: 'player' | 'coach' | 'club_admin';
  seats: number;
}
