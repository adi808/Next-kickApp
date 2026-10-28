import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from './supabase';

export interface TeamRow {
  id: string;
  name: string;
  club_id: string;
}

export interface ChildRow {
  id: string;
  full_name: string;
  photo_path: string | null;
}

// Teams the user runs (coach of the team, or club admin / system admin of its club) and the players they are
// parent of, plus their own player record when they are a player.
export function useMine() {
  const { session, profile, memberships } = useAuth();
  const uid = session?.user.id;
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [children, setChildren] = useState<ChildRow[] | null>(null);
  const [me, setMe] = useState<ChildRow | null>(null);

  useEffect(() => {
    if (!uid) return;
    const coachTeams = memberships.filter((m) => m.role === 'coach' && m.team_id).map((m) => m.team_id!);
    const adminClubs = memberships.filter((m) => m.role === 'club_admin').map((m) => m.club_id);
    let q = supabase.from('teams').select('id, name, club_id').order('name');
    if (!profile?.is_system_admin) {
      const parts = [];
      if (coachTeams.length) parts.push(`id.in.(${coachTeams.join(',')})`);
      if (adminClubs.length) parts.push(`club_id.in.(${adminClubs.join(',')})`);
      if (!parts.length) {
        setTeams([]);
      } else {
        q = q.or(parts.join(','));
      }
    }
    if (profile?.is_system_admin || coachTeams.length || adminClubs.length) {
      q.then(({ data }) => setTeams((data as TeamRow[] | null) ?? []));
    }

    supabase
      .from('guardianships')
      .select('player_id')
      .eq('parent_id', uid)
      .eq('status', 'approved')
      .then(async ({ data }) => {
        const ids = ((data as { player_id: string }[] | null) ?? []).map((g) => g.player_id);
        if (!ids.length) return setChildren([]);
        const { data: players } = await supabase
          .from('v_players')
          .select('id, full_name, photo_path')
          .in('id', ids)
          .order('full_name');
        setChildren((players as ChildRow[] | null) ?? []);
      });

    supabase
      .from('v_players')
      .select('id, full_name, photo_path')
      .eq('is_me', true)
      .maybeSingle()
      .then(({ data }) => setMe((data as ChildRow | null) ?? null));
  }, [uid, profile?.is_system_admin, memberships]);

  return { teams, children, me };
}
