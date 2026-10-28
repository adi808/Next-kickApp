import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { heError } from '../lib/errors';
import Avatar from '../components/Avatar';

interface ChildRequest {
  full_name: string;
  birth_date: string;
  email: string | null;
  phone: string | null;
}

interface JoinRequest {
  id: string;
  team_id: string;
  team_name: string;
  role: 'coach' | 'parent';
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
  children: ChildRequest[];
  created_at: string;
}

type Option = { id: string; name_he: string };

const localPhone = (p: string | null) => (p ? p.replace(/^\+972/, '0') : '');

export default function Requests({ onChange }: { onChange?: () => void }) {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [rosters, setRosters] = useState<Record<string, Option[]>>({});
  const [staffRoles, setStaffRoles] = useState<Option[]>([]);

  useEffect(() => {
    supabase.rpc('pending_join_requests').then(async ({ data }) => {
      const list = (data as JoinRequest[] | null) ?? [];
      setRequests(list);
      // The team's current players, to link a child who is already on the roster.
      const teams = [...new Set(list.filter((r) => r.role === 'parent').map((r) => r.team_id))];
      const out: Record<string, Option[]> = {};
      for (const team of teams) {
        const { data: tp } = await supabase.from('team_players').select('player_id').eq('team_id', team);
        const ids = ((tp as { player_id: string }[] | null) ?? []).map((t) => t.player_id);
        const { data: players } = ids.length
          ? await supabase.from('v_players').select('id, full_name').in('id', ids).order('full_name')
          : { data: [] };
        out[team] = ((players as { id: string; full_name: string }[] | null) ?? []).map((p) => ({
          id: p.id,
          name_he: p.full_name,
        }));
      }
      setRosters(out);
    });
    supabase
      .from('lookups')
      .select('id, name_he')
      .eq('domain', 'staff_role')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setStaffRoles((data as Option[] | null) ?? []));
  }, []);

  if (!requests) return <p>טוען…</p>;

  return (
    <section>
      <h2>בקשות הצטרפות</h2>
      {requests.length === 0 ? (
        <p>אין בקשות שממתינות לאישור.</p>
      ) : (
        <ul className="requests">
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              roster={rosters[r.team_id] ?? []}
              staffRoles={staffRoles}
              onDone={() => {
                setRequests((list) => list?.filter((x) => x.id !== r.id) ?? null);
                onChange?.();
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestCard({
  request: r,
  roster,
  staffRoles,
  onDone,
}: {
  request: JoinRequest;
  roster: Option[];
  staffRoles: Option[];
  onDone: () => void;
}) {
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [staffRole, setStaffRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('decide_join_request', {
      p_request: r.id,
      p_approve: approve,
      p_matches: Object.fromEntries(Object.entries(matches).filter(([, v]) => v)),
      p_staff_role: r.role === 'coach' && staffRole ? staffRole : null,
    });
    setBusy(false);
    if (err) return setError(heError(err));
    onDone();
  }

  return (
    <li className="card">
      <div className="who-row">
        <Avatar bucket="avatars" path={r.avatar_path} name={r.full_name} />
        <div>
          <strong>{r.full_name}</strong>
          <span className="badge">{r.role === 'coach' ? 'איש צוות' : 'הורה'}</span>
          <div className="muted">
            {r.team_name} · {new Date(r.created_at).toLocaleDateString('he-IL')}
          </div>
          <div className="muted" dir="ltr">
            {r.email}
            {r.phone && ` · ${localPhone(r.phone)}`}
          </div>
        </div>
      </div>

      {r.role === 'coach' && (
        <>
          <label htmlFor={`staff-${r.id}`}>תפקיד בצוות</label>
          <select id={`staff-${r.id}`} value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
            <option value="">מאמן</option>
            {staffRoles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_he}
              </option>
            ))}
          </select>
        </>
      )}

      {r.role === 'parent' && (
        <ul className="children">
          {r.children.map((c, i) => (
            <li key={i}>
              <strong>{c.full_name}</strong>
              <span className="muted"> · {new Date(c.birth_date).toLocaleDateString('he-IL')}</span>
              {c.email && <div className="muted" dir="ltr">{c.email}</div>}
              {roster.length > 0 && (
                <>
                  <label htmlFor={`match-${r.id}-${i}`}>שיוך</label>
                  <select
                    id={`match-${r.id}-${i}`}
                    value={matches[i] ?? ''}
                    onChange={(e) => setMatches((m) => ({ ...m, [i]: e.target.value }))}
                  >
                    <option value="">שחקן חדש בקבוצה</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        כבר ברשימה: {p.name_he}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="button" disabled={busy} onClick={() => decide(true)}>
          אישור
        </button>
        <button type="button" className="danger" disabled={busy} onClick={() => decide(false)}>
          דחייה
        </button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </li>
  );
}
