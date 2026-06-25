import type { Role, Module } from "@pleno-crm/types";

type AccessLevel = "full" | "read" | "request" | "none";

const PERMISSION_MATRIX: Record<Module, Record<Role, AccessLevel>> = {
  atendimento:    { ADMIN: "full", GESTOR: "full",    ATENDENTE: "full"    },
  contatos:       { ADMIN: "full", GESTOR: "full",    ATENDENTE: "read"    },
  kanban:         { ADMIN: "full", GESTOR: "full",    ATENDENTE: "full"    },
  campanhas:      { ADMIN: "full", GESTOR: "read",    ATENDENTE: "none"    },
  alertas:        { ADMIN: "full", GESTOR: "request", ATENDENTE: "none"    },
  automacoes:     { ADMIN: "full", GESTOR: "request", ATENDENTE: "none"    },
  integracoes:    { ADMIN: "full", GESTOR: "full",    ATENDENTE: "request" },
  configuracoes:  { ADMIN: "full", GESTOR: "none",    ATENDENTE: "none"    },
};

export function canAccess(role: string, module: Module): boolean {
  const level = PERMISSION_MATRIX[module]?.[role as Role];
  return level !== "none" && level !== undefined;
}

export function getAccessLevel(role: string, module: Module): AccessLevel {
  return PERMISSION_MATRIX[module]?.[role as Role] ?? "none";
}

export function requireRole(allowedRoles: Role[]) {
  return function (role: string): boolean {
    return allowedRoles.includes(role as Role);
  };
}

export function getDefaultRoute(role: string): string {
  switch (role as Role) {
    case "ADMIN":
    case "GESTOR":
    case "ATENDENTE":
      return "/atendimento";
    default:
      return "/login";
  }
}
