// js/core.js
export const esc = (s) =>
    s ? s.toString()
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;') : '';

export const ROLE_LABELS = {
    admin: { label: 'АДМИНИСТРАТОР', cls: 'role-admin', icon: 'fa-shield-alt' },
    dub:   { label: 'АКТЁР ДУБЛЯЖА', cls: 'role-dub',   icon: 'fa-microphone-alt' },
    user:  { label: 'ПОЛЬЗОВАТЕЛЬ',  cls: 'role-user',  icon: 'fa-user' }
};

export function getRoleBadgeHTML(role) {
    const r = ROLE_LABELS[role] || ROLE_LABELS.user;
    return `<span class=\"role-badge ${r.cls}\"><i class=\"fas ${r.icon}\"></i> ${r.label}</span>`;
}

export function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => t.remove(), 300);
    }, 4000);
}

export function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

export function navigate(page, pushState = true) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = document.getElementById(page);
    if (target) target.classList.add('active');

    const navId = { home: 'n-home', team: 'n-team', 'team-page': 'n-team', profile: 'n-profile', dubin: 'n-dubin', view: 'n-home' };
    const navEl = document.getElementById(navId[page]);
    if (navEl) navEl.classList.add('active');

    if (pushState) history.pushState(null, '', '#' + page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
