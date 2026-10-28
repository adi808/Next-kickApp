import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) return setError('כתובת אימייל לא תקינה');
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: address });
    setBusy(false);
    if (err) return setError('שליחת הקוד נכשלה. נסו שוב בעוד דקה.');
    setSentTo(address);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: sentTo,
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (err) setError('הקוד שגוי או שפג תוקפו');
  }

  async function google() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) setError('הכניסה עם Google נכשלה');
  }

  return (
    <main className="login">
      <h1>Next Team</h1>
      {!sentTo ? (
        <>
          <button type="button" className="google" onClick={google}>
            כניסה עם Google
          </button>
          <p className="or">או קוד לאימייל</p>
          <form onSubmit={sendCode}>
            <label htmlFor="email">אימייל</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button disabled={busy}>שלחו לי קוד</button>
          </form>
        </>
      ) : (
        <form onSubmit={verify}>
          <label htmlFor="code">הקוד שנשלח אל {sentTo}</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button disabled={busy}>כניסה</button>
          <button type="button" className="link" onClick={() => setSentTo(null)}>
            החלפת אימייל
          </button>
        </form>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  );
}
