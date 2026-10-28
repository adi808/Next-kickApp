import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { heError } from '../lib/errors';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { useMine } from '../lib/mine';
import Avatar from '../components/Avatar';

export default function Profile() {
  const { profile, refresh } = useAuth();
  const { children } = useMine();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState((profile?.phone ?? '').replace(/^\+972/, '0'));
  const [canDrive, setCanDrive] = useState(profile?.can_drive ?? false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <p>טוען…</p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const { error: err } = await supabase.rpc('update_my_profile', {
      p_full_name: name,
      p_phone: phone.trim() || null,
      p_can_drive: canDrive,
    });
    if (err) return setError(heError(err));
    setStatus('נשמר');
    refresh();
  }

  return (
    <section>
      <h2>הפרופיל שלי</h2>
      <form onSubmit={save}>
        <Avatar
          bucket="avatars"
          path={profile.avatar_path}
          name={name || profile.email || '?'}
          size={72}
          folder={profile.id}
          onUpload={async (path) => {
            const { error: err } = await supabase.rpc('set_my_avatar', { p_path: path });
            if (err) throw err;
            refresh();
          }}
        />
        <p className="muted" dir="ltr">{profile.email}</p>
        <label htmlFor="me-name">שם מלא</label>
        <input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="me-phone">טלפון נייד (לא חובה)</label>
        <input id="me-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="switch">
          <input type="checkbox" checked={canDrive} onChange={(e) => setCanDrive(e.target.checked)} />
          יכול/ה להסיע ילדים למשחקים
        </label>
        <button>שמירה</button>
        <p role="status" className="hint">{status}</p>
        {error && <p role="alert" className="error">{error}</p>}
      </form>

      <PushSettings />

      {!!children?.length && (
        <>
          <h3>הילדים שלי</h3>
          <ul className="cards">
            {children.map((c) => (
              <li key={c.id}>
                <Link to={`/players/${c.id}`} className="who-row">
                  <Avatar bucket="player-photos" path={c.photo_path} name={c.full_name} />
                  <strong>{c.full_name}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      setState(state === 'on' ? await disablePush() : await enablePush());
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <div className="notice">
      <h3>התראות למכשיר</h3>
      {state === 'unsupported' && (
        <p>
          המכשיר או הדפדפן הזה לא תומכים בהתראות. באייפון: פתחו בספארי, לחצו על &quot;שיתוף&quot; ואז
          &quot;הוסף למסך הבית&quot;, ופתחו את האפליקציה משם (נדרש iOS 16.4 ומעלה).
        </p>
      )}
      {state === 'denied' && <p>ההתראות חסומות בהגדרות הדפדפן. אפשרו אותן לאתר הזה ונסו שוב.</p>}
      {(state === 'on' || state === 'off') && (
        <>
          <p>{state === 'on' ? 'ההתראות פעילות במכשיר הזה.' : 'קבלו התראה על בקשות, אישורים ועדכונים.'}</p>
          <button type="button" className={state === 'on' ? 'secondary' : ''} disabled={busy} onClick={toggle}>
            {state === 'on' ? 'כיבוי התראות' : 'הפעלת התראות'}
          </button>
        </>
      )}
      {error && <p role="alert" className="error">לא הצלחנו להפעיל התראות. נסו שוב.</p>}
    </div>
  );
}
