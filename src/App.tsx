import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './pages/Login';
import RoleShell from './components/RoleShell';

// Signed out, every address shows the login, and after signing in the same address opens (e.g. a join link).
function Gate() {
  const { loading, session } = useAuth();
  if (loading) return <p className="center">טוען…</p>;
  return session ? <RoleShell /> : <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
