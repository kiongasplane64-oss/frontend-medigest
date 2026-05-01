import { Navigate, Outlet } from "react-router-dom";
import { ReactNode } from "react";

// ===== TYPES =====
type GuardProps = {
  children?: ReactNode;
};

// ===== PRIVATE ROUTE =====
export const PrivateRoute = ({ children }: GuardProps) => {
  const isAuth = true; // remplace par ton auth réel

  if (!isAuth) return <Navigate to="/login" replace />;

  return children ? <>{children}</> : <Outlet />;
};

// ===== PUBLIC ROUTE =====
export const PublicRoute = ({ children }: GuardProps) => {
  const isAuth = false;

  if (isAuth) return <Navigate to="/dashboard" replace />;

  return children ? <>{children}</> : <Outlet />;
};

// ===== ROLE BASED ROUTE =====
type RoleBasedRouteProps = {
  allowedRoles: string[];
  children?: ReactNode;
};

export const RoleBasedRoute = ({
  allowedRoles,
  children,
}: RoleBasedRouteProps) => {
  const userRole = "admin"; // remplace avec ton store

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};