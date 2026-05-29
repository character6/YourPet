import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PetPage from './pages/PetPage';
import SubscriptionPage from './pages/SubscriptionPage';
import InvitesPage from './pages/InvitesPage';
import InviteAcceptPage from './pages/InviteAcceptPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ paddingTop: 48 }}>Загрузка...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />

      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="pets/:petId" element={<PetPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="invites" element={<InvitesPage />} />
      </Route>
    </Routes>
  );
}
