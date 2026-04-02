import {
    doc, getDoc, getDocs, updateDoc, collection,
    query, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { esc, showToast, closeModals, navigate, getRoleBadgeHTML } from './core.js';

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

// ЭКСПОРТ ФУНКЦИЙ ДЛЯ АДМИН-ПАНЕЛИ
export function openRoleModal() {
    document.getElementById('m-role').style.display = 'flex';
}

export async function assignRole(db) {
    const email = document.getElementById('role-email').value.trim();
    const role  = document.getElementById('role-select').value;
    if (!email) return showToast('Введите email!', 'error');
    
    const snap = await getDocs(query(collection(db,'users'), where('email','==',email)));
    if (snap.empty) return showToast('Пользователь не найден!', 'error');
    
    await updateDoc(doc(db,'users', snap.docs[0].id), { role: role });
    showToast('Роль обновлена');
    closeModals();
}
