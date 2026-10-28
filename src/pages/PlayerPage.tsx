import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { heError } from '../lib/errors';
import Avatar from '../components/Avatar';
import AttributeFields from '../components/AttributeFields';

interface Details {
  id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  photo_path: string | null;
  photo_consent: boolean;
  account_email: string | null;
  invite_email: string | null;
  can_edit: boolean;
  is_parent: boolean;
}

export default function PlayerPage() {
  const { id = '' } = useParams();
  const [p, setP] = useState<Details | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(() => {
    supabase.rpc('player_details', { p_player: id }).then(({ data }) => {
      const row = (data as Details[] | null)?.[0];
      if (!row) setMissing(true);
      setP(row ?? null);
    });
  }, [id]);
  useEffect(load, [load]);

  if (missing) return <p>השחקן לא נמצא.</p>;
  if (!p) return <p>טוען…</p>;

  return (
    <section>
      <div className="who-row">
        <Avatar
          bucket="player-photos"
          path={p.photo_path}
          name={p.full_name}
          size={72}
          folder={p.can_edit ? p.id : undefined}
          onUpload={
            p.can_edit
              ? async (path) => {
                  const { error } = await supabase.rpc('update_player', { p_player: p.id, p_photo_path: path });
                  if (error) throw error;
                  load();
                }
              : undefined
          }
        />
        <h2>{p.full_name}</h2>
      </div>

      {p.can_edit ? <DetailsForm p={p} onSaved={load} /> : <ReadOnly p={p} />}

      <h3>פרטים נוספים</h3>
      <AttributeFields scope="player" entityId={p.id} />
    </section>
  );
}

function ReadOnly({ p }: { p: Details }) {
  return (
    <div className="fields">
      {p.birth_date && (
        <div className="field">
          <span className="label">תאריך לידה</span>
          <span>{new Date(p.birth_date).toLocaleDateString('he-IL')}</span>
        </div>
      )}
      {p.phone && (
        <div className="field">
          <span className="label">טלפון</span>
          <span dir="ltr">{p.phone.replace(/^\+972/, '0')}</span>
        </div>
      )}
    </div>
  );
}

function DetailsForm({ p, onSaved }: { p: Details; onSaved: () => void }) {
  const [name, setName] = useState(p.full_name);
  const [birth, setBirth] = useState(p.birth_date ?? '');
  const [phone, setPhone] = useState((p.phone ?? '').replace(/^\+972/, '0'));
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const r1 = await supabase.rpc('update_player', {
      p_player: p.id,
      p_full_name: name,
      p_birth_date: birth || null,
    });
    const r2 = await supabase.rpc('set_player_phone', { p_player: p.id, p_phone: phone.trim() || null });
    const r3 = email.trim()
      ? await supabase.rpc('link_player_email', { p_player: p.id, p_email: email.trim() })
      : { error: null };
    const err = r1.error ?? r2.error ?? r3.error;
    if (err) return setError(heError(err));
    setEmail('');
    setStatus('נשמר');
    onSaved();
  }

  async function consent(value: boolean) {
    const { error: err } = await supabase.rpc('set_photo_consent', { p_player: p.id, p_consent: value });
    if (err) return setError(heError(err));
    onSaved();
  }

  return (
    <form onSubmit={save}>
      <label htmlFor="pl-name">שם מלא</label>
      <input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="pl-birth">תאריך לידה</label>
      <input id="pl-birth" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      <label htmlFor="pl-phone">טלפון (לא חובה)</label>
      <input id="pl-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />

      <div className="field">
        <span className="label">חשבון באפליקציה</span>
        <span dir="ltr">
          {p.account_email ?? (p.invite_email ? `${p.invite_email} (טרם נכנס/ה)` : 'אין')}
        </span>
      </div>
      {!p.account_email && (
        <>
          <label htmlFor="pl-email">{p.invite_email ? 'החלפת אימייל של הילד/ה' : 'אימייל של הילד/ה'}</label>
          <input id="pl-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="hint">כשהילד/ה ייכנסו עם האימייל הזה, הם יראו את הקבוצה שלהם.</p>
        </>
      )}

      {p.is_parent && (
        <label className="switch">
          <input type="checkbox" checked={p.photo_consent} onChange={(e) => consent(e.target.checked)} />
          מאשר/ת להציג את התמונה לשאר הקבוצה
        </label>
      )}

      <button>שמירה</button>
      <p role="status" className="hint">{status}</p>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  );
}
