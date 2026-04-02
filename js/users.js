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
window.openUserProfile = openUserProfile;

export async function openUserProfileByName(db, auth, userData, nick) {
    const snap = await getDocs(query(collection(db,'users'), where('nickname','==',nick)));
    if (!snap.empty) openUserProfile(db, auth, userData, snap.docs[0].id);
}
window.openUserProfileByName = openUserProfileByName;

// ── Подписка / Отписка ──
export async function subscribeToUser(db, auth, targetUid, isSubbed) {
    const ref = doc(db,'users',targetUid);
    if (isSubbed) await updateDoc(ref, { subscribers: increment(-1), subscribersList: arrayRemove(auth.currentUser.uid) });
    else          await updateDoc(ref, { subscribers: increment(1),  subscribersList: arrayUnion(auth.currentUser.uid) });
    showToast(isSubbed ? 'Вы отписались' : 'Вы подписались!');
    openUserProfile(db, auth, null, targetUid);
}
window.subscribeToUser = subscribeToUser;

// ── Список подписчиков ──
export async function showMySubscribers(db, auth) {
    const uDoc = await getDoc(doc(db,'users',auth.currentUser.uid));
    const subs = uDoc.data().subscribersList||[];
    if (subs.length === 0) return showToast('Пока нет подписчиков');
    const list = document.getElementById('subs-list');
    list.innerHTML = '';
    for (let subId of subs) {
        const sd = await getDoc(doc(db,'users',subId));
        if (sd.exists()) list.innerHTML += `
            <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px;">
                <img src="${sd.data().avatar||'https://api.dicebear.com/7.x/identicon/svg'}" style="width:35px;height:35px;border-radius:50%; object-fit:cover;">
                <b style="cursor:pointer; color:var(--accent);" onclick="closeModals(); openUserProfile('${subId}')">${esc(sd.data().nickname)}</b>
            </div>`;
    }
    document.getElementById('m-subs').style.display = 'flex';
}
window.showMySubscribers = showMySubscribers;

// ── Управление ролями (только Admin) ──
export function openRoleModal() {
    document.getElementById('m-role').style.display = 'flex';
}
window.openRoleModal = openRoleModal;

export async function assignRole(db) {
    const email = document.getElementById('role-email').value.trim();
    const role  = document.getElementById('role-select').value;
    if (!email) return showToast('Введите email!', 'error');
    const snap = await getDocs(query(collection(db,'users'), where('email','==',email)));
    if (snap.empty) return showToast('Пользователь не найден!', 'error');
    await updateDoc(doc(db,'users',snap.docs[0].id), { role });
    showToast(`Роль "${role}" выдана!`); closeModals();
}
window.assignRole = assignRole;
