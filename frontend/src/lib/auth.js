// Auth helpers for client-side token management
export const setAuth = (token, user) => {
  localStorage.setItem('church_token', token);
  localStorage.setItem('church_user', JSON.stringify(user));
};

export const getAuth = () => {
  if (typeof window === 'undefined') return { token: null, user: null };
  return {
    token: localStorage.getItem('church_token'),
    user:  JSON.parse(localStorage.getItem('church_user') || 'null'),
  };
};

export const clearAuth = () => {
  localStorage.removeItem('church_token');
  localStorage.removeItem('church_user');
};

export const isAuthenticated = () => !!getAuth().token;

export const getUser = () => getAuth().user;

export const hasRole = (...roles) => {
  const user = getUser();
  return user && roles.includes(user.role);
};

export const ROLES = {
  PASTOR:       'pastor',
  ELDER:        'elder',
  GROUP_LEADER: 'group_leader',
  MEMBER:       'member',
};

export const ROLE_HIERARCHY = {
  pastor:       4,
  elder:        3,
  group_leader: 2,
  member:       1,
};

export const canManageMembers = (role) => ['pastor', 'elder', 'group_leader'].includes(role);
export const canBroadcast     = (role) => ['pastor', 'elder', 'group_leader'].includes(role);
export const canManageGroups  = (role) => role === 'pastor';
