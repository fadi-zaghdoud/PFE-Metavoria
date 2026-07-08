import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute() {
  const estAuthentifie = useAuthStore((state) => state.estAuthentifie);

  if (!estAuthentifie) {
    return <Navigate to="/connexion" replace />;
  }

  return <Outlet />;
}
