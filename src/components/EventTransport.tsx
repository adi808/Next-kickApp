import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { EventRow } from '../lib/events';
import { ROLE_LABELS, type TransportRow } from '../lib/types';

const MAX_SEATS = 20;

// A line in the breakdown: a player or a staff member, answered (seats set) or not yet.
interface Entry {
  key: string;
  playerId: string | null;
  profileId: string | null;
  name: string;
  role: TransportRow['role'];
  staffLabel: string | null;
  seats: number | null;
  editable: boolean;
  absent: boolean;
}

interface Loaded {
  canManage: boolean;
  entries: Entry[];
}

const keyOf = (playerId: string | null, profileId: string | null) =>
  playerId ? `p:${playerId}` : `s:${profileId}`;

async function load(event: EventRow, uid: string): Promise<Loaded> {
  const [manage, list, roster, kids, absences] = await Promise.all([
    supabase.rpc('can_manage_team', { p_team: event.team_id }),
    supabase.rpc('event_transport_list', { p_event: event.id }),
    supabase.from('team_players').select('player_id').eq('team_id', event.team_id),
    supabase.from('guardianships').select('player_id').eq('parent_id', uid).eq('status', 'approved'),
    supabase.from('event_responses').select('player_id').eq('event_id', event.id).eq('status', 'not_attending'),
  ]);
  if (list.error) throw list.error;

  const canManage = manage.data === true;
  const rows = (list.data as TransportRow[] | null) ?? [];
  const rosterIds = ((roster.data as { player_id: string }[] | null) ?? []).map((r) => r.player_id);
  const myKids = new Set(
    ((kids.data as { player_id: string }[] | null) ?? []).map((k) => k.player_id).filter((id) => rosterIds.includes(id)),
  );
  const absent = new Set(((absences.data as { player_id: string }[] | null) ?? []).map((a) => a.player_id));

  const entries = new Map<string, Entry>();
  for (const r of rows) {
    const key = keyOf(r.player_id, r.profile_id);
    entries.set(key, {
      key, playerId: r.player_id, profileId: r.profile_id, name: r.name, role: r.role, staffLabel: r.staff_label,
      seats: r.seats,
      editable: canManage || (r.player_id ? myKids.has(r.player_id) : r.profile_id === uid),
      absent: false,
    });
  }

  // Players with no answer yet: staff see the whole roster, a parent sees their own children.
  const playerIds = canManage ? rosterIds : [...myKids];
  const unanswered = playerIds.filter((id) => !entries.has(keyOf(id, null)));
  if (unanswered.length) {
    const { data } = await supabase.from('v_players').select('id, full_name').in('id', unanswered);
    for (const p of (data as { id: string; full_name: string }[] | null) ?? []) {
      entries.set(keyOf(p.id, null), {
        key: keyOf(p.id, null), playerId: p.id, profileId: null, name: p.full_name, role: 'player', staffLabel: null,
        seats: null,
        editable: true, absent: absent.has(p.id),
      });
    }
  }

  // Staff with no answer yet (the team's coaches and the club's admins), for staff only.
  if (canManage) {
    const { data: team } = await supabase.from('teams').select('club_id').eq('id', event.team_id).single();
    const { data } = await supabase
      .from('memberships')
      .select('user_id, role, profile:profiles(full_name, email), staff:lookups(name_he)')
      .or(`and(team_id.eq.${event.team_id},role.eq.coach),and(club_id.eq.${team?.club_id},role.eq.club_admin)`);
    const staff = (data as unknown as {
      user_id: string;
      role: 'coach' | 'club_admin';
      profile: { full_name: string; email: string | null } | null;
      staff: { name_he: string } | null;
    }[] | null) ?? [];
    // A coach of this team is listed as coach even if they are also a club admin.
    staff.sort((a, b) => (a.role === 'coach' ? -1 : 0) - (b.role === 'coach' ? -1 : 0));
    for (const m of staff) {
      const key = keyOf(null, m.user_id);
      if (entries.has(key)) continue;
      entries.set(key, {
        key, playerId: null, profileId: m.user_id, name: m.profile?.full_name || m.profile?.email || 'איש צוות',
        role: m.role, staffLabel: m.staff?.name_he ?? null, seats: null, editable: true, absent: false,
      });
    }
  }

  const order = { player: 0, coach: 1, club_admin: 2 };
  const sorted = [...entries.values()].sort(
    (a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name, 'he'),
  );
  return { canManage, entries: sorted };
}

export default function EventTransport({
  event,
  onTransportChange,
}: {
  event: EventRow;
  onTransportChange: (on: boolean) => void;
}) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    load(event, uid).then(setData, () => setError('טעינת ההסעה נכשלה'));
  }, [event, uid]);

  useEffect(refresh, [refresh]);

  async function toggle(on: boolean) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('set_event_transport', { p_event: event.id, p_enabled: on });
    setBusy(false);
    if (err) return setError('לא ניתן לעדכן את ההסעה');
    onTransportChange(on);
  }

  async function setSeats(entry: Entry, seats: number) {
    if (!data) return;
    const previous = data;
    setError(null);
    setData({ ...data, entries: data.entries.map((e) => (e.key === entry.key ? { ...e, seats } : e)) });
    const { error: err } = await supabase.rpc('set_transport_seats', {
      p_event: event.id,
      p_seats: seats,
      p_player: entry.playerId,
      p_profile: entry.profileId,
    });
    if (err) {
      setData(previous);
      setError(`לא ניתן לעדכן את ${entry.name}`);
    }
  }

  if (!data) return error ? <p role="alert" className="error">{error}</p> : <p>טוען הסעה…</p>;

  const counted = data.entries.filter((e) => !e.absent && e.seats !== null);
  const total = counted.reduce((sum, e) => sum + (e.seats ?? 0), 0);
  const players = data.entries.filter((e) => e.role === 'player');
  const staff = data.entries.filter((e) => e.role !== 'player');

  return (
    <section className="transport" aria-labelledby="transport-title">
      <h3 id="transport-title">הסעה</h3>

      {data.canManage && (
        <label className="switch">
          <input
            type="checkbox"
            checked={event.has_transport}
            disabled={busy}
            onChange={(e) => toggle(e.target.checked)}
          />
          יש הסעה לאירוע
        </label>
      )}

      {!event.has_transport ? (
        <p>לא הוגדרה הסעה לאירוע זה.</p>
      ) : (
        <>
          <div className="total" role="status">
            <span>סה״כ נוסעים</span>
            <strong>{total}</strong>
            {data.canManage && (
              <small>
                ענו {players.filter((p) => p.seats !== null && !p.absent).length} מתוך{' '}
                {players.filter((p) => !p.absent).length} שחקנים
              </small>
            )}
          </div>
          <p className="hint">מספר הנוסעים כולל את השחקן ואת מי שמצטרף אליו. 0 = לא צריך הסעה.</p>

          {players.length > 0 && <EntryList title="שחקנים" entries={players} onChange={setSeats} />}
          {staff.length > 0 && <EntryList title="צוות" entries={staff} onChange={setSeats} />}
        </>
      )}

      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}

function EntryList({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: Entry[];
  onChange: (entry: Entry, seats: number) => void;
}) {
  return (
    <>
      <h4>{title}</h4>
      <ul className="seats">
        {entries.map((e) => (
          <li key={e.key}>
            <span className="who">
              {e.name}
              {e.role !== 'player' && <small> · {e.staffLabel ?? ROLE_LABELS[e.role]}</small>}
            </span>
            {e.absent ? (
              <span className="muted">לא מגיע</span>
            ) : e.editable ? (
              <span className="stepper">
                <button
                  type="button"
                  aria-label={`הפחתת נוסע עבור ${e.name}`}
                  disabled={e.seats === 0}
                  onClick={() => onChange(e, Math.max(0, (e.seats ?? 1) - 1))}
                >
                  −
                </button>
                <output aria-live="polite">{e.seats ?? '—'}</output>
                <button
                  type="button"
                  aria-label={`הוספת נוסע עבור ${e.name}`}
                  disabled={(e.seats ?? 0) >= MAX_SEATS}
                  onClick={() => onChange(e, Math.min(MAX_SEATS, (e.seats ?? 0) + 1))}
                >
                  +
                </button>
              </span>
            ) : (
              <strong>{e.seats ?? '—'}</strong>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
