/**
 * Canonical role model — SINGLE SOURCE OF TRUTH for IntelliCare user roles.
 *
 * The product exposes exactly FOUR roles. Everything else (provider, staff,
 * medical_director, doctor_specialist, nurse_rn, nurse_lpn, billing, lab_tech,
 * receptionist, technician, ...) is LEGACY and must never be assigned, offered
 * by the agent, or shown in the UI. Legacy values are mapped onto a canonical
 * role via LEGACY_ROLE_MAP for migration and defensive coercion of old data.
 *
 *   admin   → manages the practice, users and all data
 *   doctor  → full clinical read/write, schedulable (provider)
 *   nurse   → clinical documentation, schedulable (provider)
 *   user    → basic / regular user: appointments + read-only patient info
 *
 * A brand-new user joining an existing practice always starts as `user` and
 * asks an admin to upgrade them (see the permission/role request flow).
 */

const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  USER: 'user',
};

// The only roles that may be assigned / offered / displayed.
const CANONICAL_ROLES = ['admin', 'doctor', 'nurse', 'user'];

// Default role for a brand-new user joining a practice.
const DEFAULT_ROLE = 'user';

// Clinical roles: can be set up as a schedulable provider (calendar/appointments).
const CLINICAL_ROLES = ['doctor', 'nurse'];

// Roles allowed to manage the practice (user management, role approvals, settings).
const ADMIN_ROLES = ['admin'];

// Human-friendly labels (bilingual).
const ROLE_LABELS = {
  admin: { en: 'Admin', he: 'מנהל' },
  doctor: { en: 'Doctor', he: 'רופא' },
  nurse: { en: 'Nurse', he: 'אחות' },
  user: { en: 'User', he: 'משתמש' },
};

// Short description per role (shown when the agent offers a role).
const ROLE_DESCRIPTIONS = {
  admin: { en: 'Manage the practice, users and all data', he: 'ניהול המרפאה, המשתמשים וכל הנתונים' },
  doctor: { en: 'Full clinical access, can be scheduled for appointments', he: 'גישה קלינית מלאה, ניתן לקבוע לו תורים' },
  nurse: { en: 'Clinical documentation, can be scheduled for appointments', he: 'תיעוד קליני, ניתן לקבוע לו תורים' },
  user: { en: 'Basic access: view patients and book appointments', he: 'גישה בסיסית: צפייה במטופלים וקביעת תורים' },
};

/**
 * Legacy → canonical mapping. `null` means "drop entirely" (it was a flag,
 * not a real role). Anything not listed and not canonical collapses to `user`.
 */
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
  provider: null, // provider was a flag for "schedulable", not a role — derive from CLINICAL_ROLES instead
};

/** True if `role` is one of the four canonical roles. */
function isValidRole(role) {
  return CANONICAL_ROLES.includes(role);
}

/** Map any single role (canonical or legacy) to its canonical form, or null to drop. */
function toCanonicalRole(role) {
  if (!role) return null;
  if (CANONICAL_ROLES.includes(role)) return role;
  if (Object.prototype.hasOwnProperty.call(LEGACY_ROLE_MAP, role)) return LEGACY_ROLE_MAP[role];
  return DEFAULT_ROLE; // unknown → basic user
}

/**
 * Normalize an arbitrary roles array to the canonical set: map legacy values,
 * drop nulls/dupes, and guarantee at least the default role.
 */
function normalizeRoles(roles) {
  const input = Array.isArray(roles) ? roles : [roles];
  const mapped = input.map(toCanonicalRole).filter(Boolean);
  const deduped = [...new Set(mapped)];
  return deduped.length ? deduped : [DEFAULT_ROLE];
}

/** The single most-privileged role from a roles array (admin > doctor > nurse > user). */
function primaryRole(roles) {
  const list = normalizeRoles(roles);
  for (const r of CANONICAL_ROLES) {
    if (list.includes(r)) return r;
  }
  return DEFAULT_ROLE;
}

function isClinicalRole(role) {
  return CLINICAL_ROLES.includes(toCanonicalRole(role));
}

/** True if any role in the array is clinical (schedulable as a provider). */
function rolesAreClinical(roles = []) {
  return normalizeRoles(roles).some((r) => CLINICAL_ROLES.includes(r));
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(toCanonicalRole(role));
}

function rolesAreAdmin(roles = []) {
  return normalizeRoles(roles).some((r) => ADMIN_ROLES.includes(r));
}

function roleLabel(role, lang = 'en') {
  const c = toCanonicalRole(role) || DEFAULT_ROLE;
  return (ROLE_LABELS[c] && ROLE_LABELS[c][lang]) || (ROLE_LABELS[c] && ROLE_LABELS[c].en) || c;
}

function roleDescription(role, lang = 'en') {
  const c = toCanonicalRole(role) || DEFAULT_ROLE;
  return (ROLE_DESCRIPTIONS[c] && ROLE_DESCRIPTIONS[c][lang]) || (ROLE_DESCRIPTIONS[c] && ROLE_DESCRIPTIONS[c].en) || '';
}

module.exports = {
  ROLES,
  CANONICAL_ROLES,
  DEFAULT_ROLE,
  CLINICAL_ROLES,
  ADMIN_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  LEGACY_ROLE_MAP,
  isValidRole,
  toCanonicalRole,
  normalizeRoles,
  primaryRole,
  isClinicalRole,
  rolesAreClinical,
  isAdminRole,
  rolesAreAdmin,
  roleLabel,
  roleDescription,
};
