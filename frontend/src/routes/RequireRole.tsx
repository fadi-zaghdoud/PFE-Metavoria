import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { Role } from '../types/auth';

interface RequireRoleProps {
  roles: Role[];
}

// À utiliser à l'intérieur de <ProtectedRoute> (suppose que l'utilisateur est déjà authentifié).
export function RequireRole({ roles }: RequireRoleProps) {
  const utilisateur = useAuthStore((state) => state.utilisateur);

  if (!utilisateur || !roles.includes(utilisateur.role)) {
    return <Navigate to="/tableau-de-bord" replace />;
  }

  return <Outlet />;
}
