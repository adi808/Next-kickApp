import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import Home from '../pages/Home';
import Events from '../pages/Events';
import EventPage from '../pages/EventPage';
import Join from '../pages/Join';
import Requests from '../pages/Requests';
import Notifications from '../pages/Notifications';
import Profile from '../pages/Profile';
import PlayerPage from '../pages/PlayerPage';
import TeamPage from '../pages/TeamPage';
import Avatar from './Avatar';

// Counts for the header: join requests waiting for the user's decision, and unread notifications.
function useCounts() {
  const [requests, setRequests] = useState(0);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  const load = useCallback(() => {
    supabase.rpc('pending_join_requests').then(({ data }) => setRequests((data as unknown[] | null)?.length ?? 0));
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0));
  }, []);

  useEffect(load, [load, location.pathname]);
  return { requests, unread, reload: load };
}

export default function RoleShell() {
  const { profile, signOut, refresh } = useAuth();
  const { requests, unread, reload } = useCounts();
  const name = profile?.full_name || profile?.email || '';

  return (
    <div className="shell">
      <header>
        <NavLink to="/" className="brand">
          Next Team
        </NavLink>
        <nav aria-label="ראשי">
          <NavLink to="/events">אירועים</NavLink>
          {requests > 0 && (
            <NavLink to="/requests">
              בקשות <span className="count">{requests}</span>
            </NavLink>
          )}
          <NavLink to="/notifications" aria-label={`התראות${unread ? `, ${unread} חדשות` : ''}`}>
            התראות{unread > 0 && <span className="count">{unread}</span>}
          </NavLink>
        </nav>
        <NavLink to="/me" className="me" aria-label="הפרופיל שלי">
          <Avatar bucket="avatars" path={profile?.avatar_path} name={name || '?'} size={32} />
        </NavLink>
        <button className="link" onClick={signOut}>
          יציאה
        </button>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventPage />} />
          <Route path="join/:code" element={<Join />} />
          <Route
            path="requests"
            element={
              <Requests
                onChange={() => {
                  reload();
                  refresh();
                }}
              />
            }
          />
          <Route path="notifications" element={<Notifications onRead={reload} />} />
          <Route path="me" element={<Profile />} />
          <Route path="players/:id" element={<PlayerPage />} />
          <Route path="teams/:id" element={<TeamPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
