import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { eventTitle, formatWhen, type EventRow } from '../lib/events';

export default function Events() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from('events')
      .select('id, team_id, title, starts_at, location, opponent, has_transport, type:lookups(name_he)')
      .gte('starts_at', since)
      .order('starts_at')
      .then(({ data, error: err }) => {
        if (err) setError('טעינת האירועים נכשלה');
        setEvents((data as unknown as EventRow[] | null) ?? []);
      });
  }, []);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!events) return <p>טוען…</p>;

  return (
    <section>
      <h2>אירועים קרובים</h2>
      {events.length === 0 ? (
        <p>אין אירועים קרובים.</p>
      ) : (
        <ul className="cards">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link to={`/events/${ev.id}`}>
                <strong>{eventTitle(ev)}</strong>
                <span>{formatWhen(ev.starts_at)}</span>
                {ev.has_transport && <span className="badge">הסעה</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
