import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Module, Role } from "@pleno-crm/types";

interface PermissionGateProps {
  module?: Module;
  role?: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export async function PermissionGate({
  module,
  role,
  children,
  fallback = null,
}: PermissionGateProps) {
  const session = await auth();
  if (!session?.user) return <>{fallback}</>;

  const userRole = session.user.role;

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(userRole)) return <>{fallback}</>;
  }

  if (module && !canAccess(userRole, module)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
