/**
 * Canonical role model for the frontend — mirrors apps/backend-api/config/roles.js.
 *
 * The product exposes exactly FOUR roles: admin, doctor, nurse, user.
 * Everything else is LEGACY and is mapped onto a canonical role for display
 * only (old accounts) — it must never be offered or assigned in the UI.
 *
 *   admin   → manages the practice, users and all data
 *   doctor  → full clinical access, schedulable
 *   nurse   → clinical documentation, schedulable
 *   user    → basic / regular user (the default for new joiners)
 */

export const CANONICAL_ROLES = ['admin', 'doctor', 'nurse', 'user'];

export const DEFAULT_ROLE = 'user';

export const ROLE_LABELS = {
  admin: { en: 'Admin', he: 'מנהל' },
  doctor: { en: 'Doctor', he: 'רופא' },
  nurse: { en: 'Nurse', he: 'אחות' },
  user: { en: 'User', he: 'משתמש' },
};

// Avatar / badge colors per canonical role.
export const ROLE_COLORS = {
  admin: '#8b5cf6', // purple
  doctor: '#3b82f6', // blue
  nurse: '#22c55e', // green
  user: '#7C8AA8', // slate / gray
};

// Legacy → canonical (display coercion for pre-migration data). null = drop.
const LEGACY_ROLE_MAP = {
  medical_director: 'admin',
  doctor_specialist: 'doctor',
  nurse_rn: 'nurse',
  nurse_lpn: 'nurse',
  technician: 'nurse',
  secretary: 'user',
  billing: 'user',
  lab_tech: 'user',
  receptionist: 'user',
  staff: 'user',
  provider: null,
};

/** Map any single role (canonical or legacy) to its canonical form. */
export function canonicalRole(role) {
  if (!role) return DEFAULT_ROLE;
  if (CANONICAL_ROLES.includes(role)) return role;
  if (Object.prototype.hasOwnProperty.call(LEGACY_ROLE_MAP, role)) {
    return LEGACY_ROLE_MAP[role] || DEFAULT_ROLE;
  }
  return DEFAULT_ROLE;
}

/** The single most-privileged role from a user's roles (admin > doctor > nurse > user). */
export function primaryRole(roles) {
  const list = (Array.isArray(roles) ? roles : [roles])
    .map(canonicalRole)
    .filter(Boolean);
  for (const r of CANONICAL_ROLES) {
    if (list.includes(r)) return r;
  }
  return DEFAULT_ROLE;
}

/** Human-friendly label for a role. */
export function roleLabel(role, lang = 'en') {
  const c = canonicalRole(role);
  return (ROLE_LABELS[c] && ROLE_LABELS[c][lang]) || (ROLE_LABELS[c] && ROLE_LABELS[c].en) || c;
}

/** Color for a role's avatar/badge. */
export function roleColor(role) {
  return ROLE_COLORS[canonicalRole(role)] || ROLE_COLORS[DEFAULT_ROLE];
}

/** True if the role (canonical or legacy) is clinical/schedulable. */
export function isClinicalRole(role) {
  const c = canonicalRole(role);
  return c === 'doctor' || c === 'nurse';
}

/** True if any of the user's roles is admin. */
export function isAdmin(roles) {
  return (Array.isArray(roles) ? roles : [roles]).map(canonicalRole).includes('admin');
}

/** Options for a role picker: [{ value, label }]. */
export function roleOptions(lang = 'en') {
  return CANONICAL_ROLES.map((value) => ({ value, label: roleLabel(value, lang) }));
}
