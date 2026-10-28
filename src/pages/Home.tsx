import { Link } from 'react-router-dom';
import { useMine } from '../lib/mine';
import Avatar from '../components/Avatar';

export default function Home() {
  const { teams, children, me } = useMine();
  if (teams === null && children === null) return <p>טוען…</p>;

  const nothing = !teams?.length && !children?.length && !me;

  return (
    <section>
      {nothing && (
        <p>
          עדיין אין לכם שיוך לקבוצה. בקשו מהמאמן קישור הצטרפות, או המתינו לאישור הבקשה ששלחתם.
        </p>
      )}

      {!!teams?.length && (
        <>
          <h2>הקבוצות שלי</h2>
          <ul className="cards">
            {teams.map((t) => (
              <li key={t.id}>
                <Link to={`/teams/${t.id}`}>
                  <strong>{t.name}</strong>
                  <span className="muted">קישור הצטרפות, שחקנים והגדרות</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {!!children?.length && (
        <>
          <h2>הילדים שלי</h2>
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

      {me && (
        <>
          <h2>הפרופיל שלי כשחקן</h2>
          <ul className="cards">
            <li>
              <Link to={`/players/${me.id}`} className="who-row">
                <Avatar bucket="player-photos" path={me.photo_path} name={me.full_name} />
                <strong>{me.full_name}</strong>
              </Link>
            </li>
          </ul>
        </>
      )}

      <p>
        <Link to="/events">לאירועים הקרובים ←</Link>
      </p>
    </section>
  );
}
