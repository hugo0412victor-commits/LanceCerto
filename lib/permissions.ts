const ADMIN_ROLE = "ADMIN";
const MANAGER_ROLE = "MANAGER";
const VIEWER_ROLE = "VIEWER";

export function canWrite(role?: string | null) {
  return role === ADMIN_ROLE || role === MANAGER_ROLE;
}

export function canDelete(role?: string | null) {
  return role === ADMIN_ROLE;
}

export function isViewer(role?: string | null) {
  return role === VIEWER_ROLE;
}

export function assertCanWrite(role?: string | null) {
  if (!canWrite(role)) {
    throw new Error("Permissao insuficiente para cadastrar ou editar dados.");
  }
}

export function assertCanDelete(role?: string | null) {
  if (!canDelete(role)) {
    throw new Error("Permissao insuficiente para excluir dados.");
  }
}

export function assertAdmin(role?: string | null) {
  if (role !== ADMIN_ROLE) {
    throw new Error("Permissao insuficiente para administrar configuracoes.");
  }
}
