// ============================================================
//  js/users.js — Профили пользователей, подписки, роли
// ============================================================

import {
    doc, getDoc, getDocs, updateDoc, collection,
    query, where, increment, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals, navigate, getRoleBadgeHTML } from './core.js';

// ── Открыть профиль другого пользователя ──
export async function openUserProfile(db, auth, userData, uid) {
    if (userData && uid === auth.currentUser.uid) { navigate('profile'); return; }
    const snap = await getDoc(doc(db,'users',uid));
    if (!snap.exists()) return;
    const u = snap.data();
    document.getElementById('mu-ava').src  = u.avatar||'https://api.dicebear.com/7.x/identicon/svg';
    document.getElementById('mu-nick').innerText  = u.nickname;
    document.getElementById('mu-role-badge').innerHTML = getRoleBadgeHTML(u.role);
    document.getElementById('mu-views-count').innerText = u.views||0;
    document.getElementById('mu-subs-count').innerText  = u.subscribers||0;

    const subBtn = document.getElementById('btn-mu-sub');
    if (userData) {
        const amISubbed = (u.subscribersList||[]).includes(auth.currentUser.uid);
        subBtn.innerText   = amISubbed ? 'Отписаться' : 'Подписаться';
        subBtn.className   = amISubbed ? 'btn btn-outline' : 'btn';
        subBtn.onclick     = () => subscribeToUser(db, auth, uid, amISubbed);
        subBtn.style.display = 'block';
    } else subBtn.style.display = 'none';

    const achs = u.achievements||[];
    document.getElementById('mu-ach-list').innerHTML = achs.filter(a=>!a.hidden).map(a =>
        `<div style="background:var(--input-bg); padding:10px; border-radius:10px; font-size:22px; cursor:pointer; border:1px solid var(--border);" title="${esc(a.name)}">${a.img}</div>`
    ).join('');
    document.getElementById('m-user-profile').style.display = 'flex';
}

// ── Подписка / Отписка ──
export async function subscribeToUser(db, auth, targetUid, isSubbed) {
    const ref = doc(db,'users',targetUid);
    if (isSubbed) await updateDoc(ref, { subscribers: increment(-1), subscribersList: arrayRemove(auth.currentUser.uid) });
    else          await updateDoc(ref, { subscribers: increment(1),  subscribersList: arrayUnion(auth.currentUser.uid) });
    showToast(isSubbed ? 'Вы отписались' : 'Вы подписались!');
    openUserProfile(db, auth, null, targetUid);
}
    document.getElementById('m-subs').style.display = 'flex';
}

// ── Управление ролями (только Admin) ──
export function openRoleModal() {
    document.getElementById('m-role').style.display = 'flex';
}
