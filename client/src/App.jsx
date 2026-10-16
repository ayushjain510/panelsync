import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { getToken, setToken } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import Setup from './pages/Setup';
import Schedule from './pages/Schedule';
import PublicPanel from './pages/PublicPanel';

function Shell() {
  const navigate = useNavigate();
  if (!getToken()) return <Navigate to="/login" replace />;

  const signOut = () => {
    setToken(null);
    navigate('/login');
  };

  return (
    <>
      <header className="topbar">
        <span className="brand">PanelSync</span>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/groups">Groups</NavLink>
          <NavLink to="/setup">Panels and rooms</NavLink>
          <NavLink to="/schedule">Schedule</NavLink>
        </nav>
        <button className="link" onClick={signOut}>Sign out</button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/p/:token" element={<PublicPanel />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/schedule" element={<Schedule />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
