import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { heError } from '../lib/errors';
import Avatar from '../components/Avatar';
import AttributeFields from '../components/AttributeFields';

interface Team {
  id: string;
  name: string;
  club: { id: string; name: string; phone: string | null; address: string; website: string } | null;
}

interface StaffRow {
  membership_id: string;
  user_id: string;
  full_name: string;
  avatar_path: string | null;
  staff_role_id: string | null;
}

export default function TeamPage() {
  const { id = '' } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isClubAdmin, setIsClubAdmin] = useState(false);
  const [players, setPlayers] = useState<{ id: string; full_name: string; photo_path: string | null }[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffRoles, setStaffRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, club:clubs(id, name, phone, address, website)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const t = data as unknown as Team | null;
        setTeam(t);
        if (t?.club) supabase.rpc('is_club_admin', { p_club: t.club.id }).then(({ data: a }) => setIsClubAdmin(a === true));
      });
    supabase.rpc('can_manage_team', { p_team: id }).then(({ data }) => setCanManage(data === true));
    supabase.rpc('team_staff', { p_team: id }).then(({ data }) => setStaff((data as StaffRow[] | null) ?? []));
    supabase
      .from('lookups')
      .select('id, name_he')
      .eq('domain', 'staff_role')
      .then(({ data }) =>
        setStaffRoles(Object.fromEntries(((data as { id: string; name_he: string }[] | null) ?? []).map((l) => [l.id, l.name_he]))),
      );
    supabase
      .from('team_players')
      .select('player_id')
      .eq('team_id', id)
      .then(async ({ data }) => {
        const ids = ((data as { player_id: string }[] | null) ?? []).map((t) => t.player_id);
        if (!ids.length) return setPlayers([]);
        const { data: rows } = await supabase
          .from('v_players')
          .select('id, full_name, photo_path')
          .in('id', ids)
          .order('full_name');
        setPlayers((rows as { id: string; full_name: string; photo_path: string | null }[] | null) ?? []);
      });
  }, [id]);

  if (!team) return <p>טוען…</p>;

  return (
    <section>
      <h2>{team.name}</h2>
      <p className="muted">{team.club?.name}</p>

      {canManage && <JoinLink teamId={team.id} />}

      <h3>צוות</h3>
      <ul className="seats">
        {staff.map((s) => (
          <li key={s.membership_id}>
            <span className="who-row">
              <Avatar bucket="avatars" path={s.avatar_path} name={s.full_name} size={36} />
              {s.full_name}
            </span>
            <span className="muted">{(s.staff_role_id && staffRoles[s.staff_role_id]) || 'מאמן'}</span>
          </li>
        ))}
      </ul>

      <h3>שחקנים ({players.length})</h3>
      <ul className="seats">
        {players.map((p) => (
          <li key={p.id}>
            <Link to={`/players/${p.id}`} className="who-row">
              <Avatar bucket="player-photos" path={p.photo_path} name={p.full_name} size={36} />
              {p.full_name}
            </Link>
          </li>
        ))}
      </ul>

      <h3>פרטי הקבוצה</h3>
      <AttributeFields scope="team" entityId={team.id} />

      {isClubAdmin && team.club && <ClubDetails club={team.club} />}
    </section>
  );
}

function JoinLink({ teamId }: { teamId: string }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    supabase
      .from('join_links')
      .select('code')
      .eq('team_id', teamId)
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => setCode((data as { code: string } | null)?.code ?? null));
  }, [teamId]);
  useEffect(load, [load]);

  const url = code ? `${window.location.origin}/join/${code}` : '';

  async function create() {
    setError(null);
    const { error: err } = await supabase.rpc('create_join_link', { p_team: teamId });
    if (err) return setError(heError(err));
    load();
  }

  async function disable() {
    setError(null);
    const { error: err } = await supabase.rpc('disable_join_link', { p_team: teamId });
    if (err) return setError(heError(err));
    load();
  }

  async function share() {
    const text = 'הצטרפות לקבוצה ב-Next Team: נכנסים לקישור, מתחברים ושולחים בקשה.';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Next Team', text, url });
        return;
      } catch {
        // cancelled: fall back to copying
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (code === undefined) return null;

  return (
    <div className="notice">
      <h3>קישור הצטרפות</h3>
      {code ? (
        <>
          <p>שלחו את הקישור למאמנים ולהורים. כל בקשה תגיע לאישור לפני שהמצטרף יראה את הקבוצה.</p>
          <input readOnly dir="ltr" value={url} onFocus={(e) => e.target.select()} aria-label="קישור הצטרפות" />
          <div className="actions">
            <button type="button" onClick={share}>
              {copied ? 'הקישור הועתק' : 'שיתוף / העתקה'}
            </button>
            <button type="button" className="secondary" onClick={create}>
              קישור חדש
            </button>
            <button type="button" className="link" onClick={disable}>
              ביטול הקישור
            </button>
          </div>
          <p className="hint">&quot;קישור חדש&quot; מבטל את הקודם.</p>
        </>
      ) : (
        <>
          <p>אין קישור פעיל לקבוצה.</p>
          <button type="button" onClick={create}>
            יצירת קישור הצטרפות
          </button>
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}

function ClubDetails({ club }: { club: NonNullable<Team['club']> }) {
  const [phone, setPhone] = useState((club.phone ?? '').replace(/^\+972/, '0'));
  const [address, setAddress] = useState(club.address);
  const [website, setWebsite] = useState(club.website);
  const [status, setStatus] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('update_club_details', {
      p_club: club.id,
      p_phone: phone.trim() || null,
      p_address: address,
      p_website: website,
    });
    setStatus(error ? heError(error) : 'נשמר');
  }

  return (
    <form onSubmit={save}>
      <h3>פרטי המועדון: {club.name}</h3>
      <label htmlFor="club-phone">טלפון (לא חובה)</label>
      <input id="club-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label htmlFor="club-address">כתובת</label>
      <input id="club-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label htmlFor="club-site">אתר</label>
      <input id="club-site" type="url" dir="ltr" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button>שמירה</button>
      <p role="status" className="hint">{status}</p>
    </form>
  );
}
