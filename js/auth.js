// ============================================================
//  js/auth.js — Авторизация, профиль пользователя
// ============================================================

import {
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, sendPasswordResetEmail, updatePassword, updateEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    doc, getDoc, setDoc, updateDoc, getDocs,
    collection, query, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { showToast, closeModals, navigate, getRoleBadgeHTML } from './core.js';
import { renderAchProfile } from './achievements.js';

let loginAttempts = 0;

// ── Экспортируем для использования в других модулях ──
export let userData = null;
export let isAdmin  = false;
export let isDub    = false;

// ── Вход ──
export function initAuthListeners(auth, db) {
    document.getElementById('btn-login').onclick = async () => {
        const e = document.getElementById('email').value.trim();
        const p = document.getElementById('pass').value;
        try {
            await signInWithEmailAndPassword(auth, e, p);
            showToast('Вход выполнен!');
            loginAttempts = 0;
        } catch(err) {
            loginAttempts++;
            if (loginAttempts >= 3)
                document.getElementById('reset-pass-block').style.display = 'block';
            showToast('Ошибка входа!', 'error');
        }
    };

    // ── Регистрация ──
    document.getElementById('btn-reg').onclick = async () => {
        const e = document.getElementById('email').value.trim();
        const p = document.getElementById('pass').value;
        if (!e || p.length < 6)
            return showToast('Заполните email и пароль (мин. 6 символов)!', 'error');
        try {
            const cred = await createUserWithEmailAndPassword(auth, e, p);
            await setDoc(doc(db, 'users', cred.user.uid), {
                nickname: 'User_' + Math.floor(Math.random() * 10000),
                email: e, role: 'user', views: 0, subscribers: 0,
                achievements: [{
                    name: 'Новичок', desc: 'Зарегистрировался на сайте',
                    img: '👋', date: Date.now(), hidden: false
                }]
            });
            showToast('Регистрация успешна!');
        } catch(err) { showToast(err.message, 'error'); }
    };

    // ── Выход ──
    document.getElementById('btn-logout').onclick = () =>
        signOut(auth).then(() => { showToast('Вы вышли из аккаунта'); navigate('home'); });
}

// ── Сброс пароля ──
window.resetPassword = async function(auth) {
    const e = document.getElementById('email').value.trim();
    if (!e) return showToast('Введите email!', 'error');
    try { await sendPasswordResetEmail(auth, e); showToast('Письмо отправлено!'); }
    catch(err) { showToast(err.message, 'error'); }
};

// ── Смена email ──
window.changeUserEmail = async function(auth) {
    const newEmail = document.getElementById('ed-new-email').value.trim();
    if (!newEmail) return;
    try { await updateEmail(auth.currentUser, newEmail); showToast('Email изменён!'); closeModals(); }
    catch(err) { showToast(err.message, 'error'); }
};

// ── Смена пароля ──
window.changeUserPass = async function(auth) {
    const newPass = document.getElementById('ed-new-pass').value;
    if (!newPass || newPass.length < 6) return showToast('Минимум 6 символов!', 'error');
    try { await updatePassword(auth.currentUser, newPass); showToast('Пароль изменён!'); closeModals(); }
    catch(err) { showToast(err.message, 'error'); }
};

// ── Сохранение профиля ──
window.saveProfile = async function(auth, db, _userData) {
    const nick = document.getElementById('ed-nick').value.trim();
    const ava  = document.getElementById('ed-ava').value.trim();
    if (!nick) return showToast('Введите никнейм!', 'error');
    const snap = await getDocs(query(collection(db,'users'), where('nickname','==',nick)));
    if (!snap.empty && nick !== _userData.nickname)
        return showToast('Этот никнейм занят!', 'error');
    await updateDoc(doc(db,'users',auth.currentUser.uid), { nickname: nick, avatar: ava });
    _userData.nickname = nick; _userData.avatar = ava;
    document.getElementById('u-nick').innerText = nick;
    document.getElementById('u-ava').src = ava || 'https://api.dicebear.com/7.x/identicon/svg';
    showToast('Профиль обновлён!'); closeModals();
};

// ── Обновление UI после авторизации ──
export function applyUserUI(user, _userData, _isAdmin, _isDub) {
    document.getElementById('auth-ui').style.display   = 'none';
    document.getElementById('user-ui').style.display   = 'block';
    document.getElementById('comm-form').style.display = 'block';
    document.getElementById('comm-auth-msg').style.display = 'none';

    document.getElementById('u-nick').innerText = _userData.nickname;
    document.getElementById('ed-nick').value    = _userData.nickname;
    document.getElementById('u-ava').src        = _userData.avatar || 'https://api.dicebear.com/7.x/identicon/svg';
    document.getElementById('ed-ava').value     = _userData.avatar || '';
    document.getElementById('u-role-badge').innerHTML = getRoleBadgeHTML(_userData.role);
    document.getElementById('u-views').innerText = _userData.views || 0;
    document.getElementById('u-subs').innerText  = _userData.subscribers || 0;

    renderAchProfile(_userData);

    document.getElementById('adm-btn-rel').style.display   = _isAdmin ? 'inline-flex' : 'none';
    document.getElementById('adm-btn-team').style.display  = _isAdmin ? 'inline-flex' : 'none';
    document.getElementById('adm-btn-role').style.display  = _isAdmin ? 'inline-flex' : 'none';
    document.getElementById('adm-ach-panel').style.display = _isAdmin ? 'block' : 'none';
    document.getElementById('n-dubin').style.display = _isDub ? 'block' : 'none';
}

// ── Сброс UI при выходе ──
export function resetUserUI() {
    document.getElementById('auth-ui').style.display   = 'block';
    document.getElementById('user-ui').style.display   = 'none';
    document.getElementById('comm-form').style.display = 'none';
    document.getElementById('comm-auth-msg').style.display = 'block';
    ['adm-btn-rel','adm-btn-team','adm-btn-role','adm-ach-panel','n-dubin'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
}
