import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  title: string;
  body: string;
  url: string;
  created_at: string;
  read_at: string | null;
}

export default function Notifications({ onRead }: { onRead?: () => void }) {
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    supabase
      .from('notifications')
      .select('id, title, body, url, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setItems((data as Notification[] | null) ?? []);
        supabase.rpc('mark_notifications_read').then(() => onRead?.());
      });
  }, [onRead]);

  if (!items) return <p>טוען…</p>;

  return (
    <section>
      <h2>התראות</h2>
      {items.length === 0 ? (
        <p>אין התראות.</p>
      ) : (
        <ul className="cards">
          {items.map((n) => (
            <li key={n.id} className={n.read_at ? '' : 'unread'}>
              <Link to={n.url}>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
                <small className="muted">{new Date(n.created_at).toLocaleString('he-IL')}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
