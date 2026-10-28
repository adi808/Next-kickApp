import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { eventTitle, formatWhen, type EventRow } from '../lib/events';
import EventTransport from '../components/EventTransport';

export default function EventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('events')
      .select('id, team_id, title, starts_at, location, opponent, has_transport, type:lookups(name_he)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setMissing(true);
        setEvent(data as unknown as EventRow | null);
      });
  }, [id]);

  if (missing) return <p>האירוע לא נמצא.</p>;
  if (!event) return <p>טוען…</p>;

  return (
    <section>
      <Link to="/events">→ לכל האירועים</Link>
      <h2>{eventTitle(event)}</h2>
      <p>
        {formatWhen(event.starts_at)}
        {event.location && ` · ${event.location}`}
      </p>
      <EventTransport
        event={event}
        onTransportChange={(on) => setEvent({ ...event, has_transport: on })}
      />
    </section>
  );
}
