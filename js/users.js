// js/users.js
import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { esc, navigate, getRoleBadgeHTML } from './core.js';

export async function openUserProfile(db, auth, userData, uid) {
    if (userData && uid === auth.currentUser.uid) { navigate('profile'); return; }
    const snap = await getDoc(doc(db,'users',uid));
    if (!snap.exists()) return;
    const u = snap.data();
    
    document.getElementById('mu-ava').src = u.avatar || 'https://api.dicebear.com/7.x/identicon/svg';
    document.getElementById('mu-nick').innerText = u.nickname;
    document.getElementById('mu-role-badge').innerHTML = getRoleBadgeHTML(u.role);
    
    document.getElementById('m-user-profile').style.display = 'flex';
}

export async function openUserProfileByName(db, auth, userData, name) {
    const q = query(collection(db,'users'), where('nickname','==',name));
    const snap = await getDocs(q);
    if(!snap.empty) openUserProfile(db, auth, userData, snap.docs[0].id);
}

// ... (начало файла без изменений) ...

// ── Управление ролями (только Admin) ──
// Добавляем export здесь:
export function openRoleModal() {
    document.getElementById('m-role').style.display = 'flex';
}

// И здесь:
export async function assignRole(db) {
    const email = document.getElementById('role-email').value.trim();
    const role  = document.getElementById('role-select').value;
    if (!email) return showToast('Введите email!', 'error');
    
    const snap = await getDocs(query(collection(db,'users'), where('email','==',email)));
    if (snap.empty) return showToast('Пользователь не найден!', 'error');
    
    const uRef = doc(db,'users', snap.docs[0].id);
    await updateDoc(uRef, { role: role });
    showToast(`Роль для ${email} изменена на ${role}`);
    closeModals();
}

// Эти строки можно оставить для подстраховки, но export обязателен
window.openRoleModal = openRoleModal;
window.assignRole = assignRole;
