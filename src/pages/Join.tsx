import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { heError } from '../lib/errors';
import Avatar from '../components/Avatar';

interface LinkInfo {
  team_id: string;
  team_name: string;
  club_name: string;
  sport_name: string | null;
  my_status: 'coach' | 'member' | 'pending' | 'none';
}

interface Child {
  full_name: string;
  birth_date: string;
  email: string;
  phone: string;
}

const emptyChild = (): Child => ({ full_name: '', birth_date: '', email: '', phone: '' });

export default function Join() {
  const { code = '' } = useParams();
  const { profile, refresh } = useAuth();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingChild, setAddingChild] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.rpc('join_link_info', { p_code: code }).then(({ data, error }) => {
      if (error || !data?.[0]) return setLoadError(heError(error, 'הקישור לא נמצא.'));
      setInfo(data[0] as LinkInfo);
    });
  }, [code]);

  if (loadError) return <p role="alert" className="error">{loadError}</p>;
  if (!info) return <p>טוען…</p>;

  const header = (
    <>
      <h2>הצטרפות לקבוצה</h2>
      <p className="team-line">
        <strong>{info.team_name}</strong> · {info.club_name}
        {info.sport_name && ` · ${info.sport_name}`}
      </p>
    </>
  );

  if (sent || info.my_status === 'pending') {
    return (
      <section>
        {header}
        <div className="notice">
          <strong>הבקשה נשלחה וממתינה לאישור.</strong>
          <p>תקבלו התראה כשהמאמן או מנהל המועדון יאשרו אותה.</p>
        </div>
        <Link to="/">למסך הבית</Link>
      </section>
    );
  }

  if (info.my_status === 'coach' || (info.my_status === 'member' && !addingChild)) {
    return (
      <section>
        {header}
        <div className="notice">
          <strong>{info.my_status === 'coach' ? 'אתם בצוות הקבוצה.' : 'אתם כבר רשומים בקבוצה.'}</strong>
        </div>
        <div className="actions">
          <Link className="button" to="/">
            כניסה
          </Link>
          {info.my_status === 'member' && (
            <button type="button" className="secondary" onClick={() => setAddingChild(true)}>
              רישום ילד נוסף
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      {header}
      <JoinForm
        code={code}
        parentOnly={addingChild}
        defaultName={profile?.full_name ?? ''}
        defaultPhone={profile?.phone ?? ''}
        avatarPath={profile?.avatar_path ?? null}
        userId={profile?.id ?? ''}
        onAvatar={refresh}
        onSent={() => setSent(true)}
      />
    </section>
  );
}

function JoinForm({
  code,
  parentOnly,
  defaultName,
  defaultPhone,
  avatarPath,
  userId,
  onAvatar,
  onSent,
}: {
  code: string;
  parentOnly: boolean;
  defaultName: string;
  defaultPhone: string;
  avatarPath: string | null;
  userId: string;
  onAvatar: () => void;
  onSent: () => void;
}) {
  const [role, setRole] = useState<'parent' | 'coach'>('parent');
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone.replace(/^\+972/, '0'));
  const [children, setChildren] = useState<Child[]>([emptyChild()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setChild = (i: number, patch: Partial<Child>) =>
    setChildren((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('צריך למלא שם.');
    if (role === 'parent' && children.some((c) => !c.full_name.trim() || !c.birth_date)) {
      return setError('לכל ילד צריך שם ותאריך לידה.');
    }
    setBusy(true);
    const { error: err } = await supabase.rpc('submit_join_request', {
      p_code: code,
      p_role: role,
      p_full_name: name.trim(),
      p_phone: phone.trim() || null,
      p_children: role === 'parent' ? children : [],
    });
    setBusy(false);
    if (err) return setError(heError(err));
    onSent();
  }

  return (
    <form className="join" onSubmit={submit}>
      {!parentOnly && (
        <fieldset>
          <legend>אני מצטרף/ת כ…</legend>
          <div className="choice">
            <label>
              <input type="radio" name="role" checked={role === 'parent'} onChange={() => setRole('parent')} />
              הורה
            </label>
            <label>
              <input type="radio" name="role" checked={role === 'coach'} onChange={() => setRole('coach')} />
              מאמן / איש צוות
            </label>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>הפרטים שלי</legend>
        <Avatar
          bucket="avatars"
          path={avatarPath}
          name={name || '?'}
          size={64}
          folder={userId}
          onUpload={async (path) => {
            const { error: err } = await supabase.rpc('set_my_avatar', { p_path: path });
            if (err) throw err;
            onAvatar();
          }}
        />
        <label htmlFor="join-name">שם מלא</label>
        <input id="join-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="join-phone">טלפון נייד (לא חובה)</label>
        <input
          id="join-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="050-0000000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </fieldset>

      {role === 'parent' &&
        children.map((c, i) => (
          <fieldset key={i} className="child">
            <legend>{children.length > 1 ? `ילד/ה ${i + 1}` : 'הילד/ה'}</legend>
            <label htmlFor={`child-name-${i}`}>שם מלא</label>
            <input id={`child-name-${i}`} value={c.full_name} onChange={(e) => setChild(i, { full_name: e.target.value })} />
            <label htmlFor={`child-birth-${i}`}>תאריך לידה</label>
            <input
              id={`child-birth-${i}`}
              type="date"
              value={c.birth_date}
              onChange={(e) => setChild(i, { birth_date: e.target.value })}
            />
            <label htmlFor={`child-email-${i}`}>אימייל של הילד/ה (לא חובה)</label>
            <input
              id={`child-email-${i}`}
              type="email"
              dir="ltr"
              value={c.email}
              onChange={(e) => setChild(i, { email: e.target.value })}
            />
            <p className="hint">עם האימייל הזה הילד/ה יוכלו להיכנס לאפליקציה ולראות את הקבוצה.</p>
            <label htmlFor={`child-phone-${i}`}>טלפון של הילד/ה (לא חובה)</label>
            <input
              id={`child-phone-${i}`}
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={c.phone}
              onChange={(e) => setChild(i, { phone: e.target.value })}
            />
            {children.length > 1 && (
              <button
                type="button"
                className="link"
                onClick={() => setChildren((list) => list.filter((_, j) => j !== i))}
              >
                הסרת ילד/ה
              </button>
            )}
          </fieldset>
        ))}
      {role === 'parent' && children.length < 6 && (
        <button type="button" className="secondary" onClick={() => setChildren((l) => [...l, emptyChild()])}>
          + ילד/ה נוסף/ת
        </button>
      )}

      <button disabled={busy}>{busy ? 'שולח…' : 'שליחה לאישור'}</button>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  );
}
