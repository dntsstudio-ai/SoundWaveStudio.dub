// ============================================================
//  js/app.js — Точка входа. Всё работает через getState().
// ============================================================

import { initializeApp }             from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG, EMAILJS_CONFIG } from '../config/config.js';
import { navigate, closeModals, showToast } from './core.js';
import { initAuthListeners, applyUserUI, resetUserUI, bindAuthActions } from './auth.js';
import { renderAchProfile, bindAchievements } from './achievements.js';
import { loadReleases, bindReleases, enableSearch, disableSearch } from './releases.js';
import { bindComments }                        from './comments.js';
import { bindTeam }                            from './team.js';
import { bindUsers }                           from './users.js';
import { initDubinPanel, bindDubin }           from './dubin.js';
import { bindOrder }                           from './order.js';

const app  = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

if (window.emailjs) emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

// ── Единое хранилище состояния ──
const state = {
    userData: null,
    isAdmin:  false,
    isDub:    false,
    isMod:    false,
    curProj:  null
};
const getState = () => state;

// ── Регистрируем все window.* ──
bindReleases(db, auth, getState);
bindComments(db, auth, getState);
bindTeam(db, getState);
bindUsers(db, auth, getState);
bindAchievements(db, auth, getState);
bindDubin(db, auth, getState);
bindAuthActions(auth, db, getState);
bindOrder(db, auth, getState);

window.closeModals = closeModals;

// Мост для поиска (core.js вызывает через window._releases*)
window._releasesEnableSearch  = enableSearch;
window._releasesDisableSearch = disableSearch;
window.showToast   = showToast;

// ── Navigate с загрузкой данных секций ──
window.navigate = (page, pushState = true) => {
    navigate(page, pushState);
    if (page === 'team')  window.loadTeam();
    if (page === 'dubin') {
        initDubinPanel(state.isAdmin, state.isDub);
        if (state.isDub) window.renderDubinProjects();
    }
    if (page === 'profile' && state.userData) window.loadMyLists();
};

// ── Синхронизация curProj: перехватываем openView ──
const _origOpenView = window.openView;
window.openView = async (id) => {
    await _origOpenView(id);
    // releases.js экспортирует curProj — синхронизируем
    const mod = await import('./releases.js');
    state.curProj = mod.curProj;
};

// ── Auth State ──
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const snap = await getDoc(doc(db,'users',user.uid));
            if (snap.exists()) {
                state.userData = snap.data();
                state.isAdmin  = state.userData.role === 'admin';
                state.isDub    = state.userData.role === 'dub' || state.isAdmin;
                state.isMod    = state.userData.role === 'moderator';
                applyUserUI(state.userData, state.isAdmin, state.isDub);
                renderAchProfile(state.userData);
            } else { resetUserUI(); }
        } catch(e) { console.error('Профиль:', e); resetUserUI(); }
    } else {
        state.userData = null; state.isAdmin = false; state.isDub = false; state.isMod = false;
        resetUserUI();
    }

    await loadReleases(db, state.isAdmin);
    initAuthListeners(auth, db);

export function initAuthListeners(auth, db) {
    document.getElementById('btn-login').onclick = async () => {
        const e = document.getElementById('email').value.trim();
        const p = document.getElementById('pass').value;
        try {
            await signInWithEmailAndPassword(auth, e, p);
            showToast('Вход выполнен!'); loginAttempts = 0;
        } catch(err) {
            loginAttempts++;
            // Показываем блок восстановления после 3 неудачных попыток
            if (loginAttempts >= 3) {
                document.getElementById('reset-pass-block').style.display = 'block';
            }
            showToast(authErrorMsg(err.code), 'error');
        }
    };

    
    const hashPage = window.location.hash.replace('#','') || 'home';
    if (hashPage === 'dubin' && !state.isDub) window.navigate('home', false);
    else window.navigate(hashPage, false);
});

window.addEventListener('popstate', () => {
    const page = window.location.hash.replace('#','') || 'home';
    window.navigate(page, false);
});


// ============================================================
//  ДОПОЛНЕНИЕ К auth.js — Интеграция восстановления пароля
// ============================================================

// Добавь эти изменения в существующий файл auth.js

// ── В функцию initAuthListeners добавь обработчик для ссылки восстановления ──
export function initAuthListeners(auth, db) {
    document.getElementById('btn-login').onclick = async () => {
        const e = document.getElementById('email').value.trim();
        const p = document.getElementById('pass').value;
        try {
            await signInWithEmailAndPassword(auth, e, p);
            showToast('Вход выполнен!'); loginAttempts = 0;
        } catch(err) {
            loginAttempts++;
            // Показываем блок восстановления после 3 неудачных попыток
            if (loginAttempts >= 3) {
                document.getElementById('reset-pass-block').style.display = 'block';
            }
            showToast(authErrorMsg(err.code), 'error');
        }
    };

    // ... остальной код ...
}

// ── Улучшенная функция resetPassword в bindAuthActions ──
export function bindAuthActions(auth, db, getState) {
    
    // ВАРИАНТ 1: Перенаправление на отдельную страницу (рекомендуется)
    window.resetPassword = () => {
        const e = document.getElementById('email').value.trim();
        if (!e) {
            // Если email не введен, просто открываем страницу
            window.location.href = 'reset-password.html';
        } else {
            // Передаем email через URL параметр для автозаполнения
            window.location.href = `reset-password.html?email=${encodeURIComponent(e)}`;
        }
    };

    // ВАРИАНТ 2: Отправка прямо из формы входа (альтернатива)
    /*
    window.resetPassword = async () => {
        const e = document.getElementById('email').value.trim();
        if (!e) return showToast('Введите email!','error');
        try { 
            const actionCodeSettings = {
                url: window.location.origin + '/index.html',
                handleCodeInApp: false,
            };
            await sendPasswordResetEmail(auth, e, actionCodeSettings); 
            showToast('Письмо для восстановления отправлено! Проверьте почту.'); 
            document.getElementById('reset-pass-block').style.display = 'none';
        }
        catch(err) { 
            showToast(authErrorMsg(err.code), 'error'); 
        }
    };
    */

    // Функция для перехода на страницу восстановления из настроек профиля
    window.openResetPasswordPage = () => {
        const currentEmail = auth.currentUser?.email || '';
        window.location.href = `reset-password.html?email=${encodeURIComponent(currentEmail)}`;
    };

    window.changeUserEmail = async () => {
        const newEmail = document.getElementById('ed-new-email').value.trim();
        if (!newEmail) return;
        try { await updateEmail(auth.currentUser, newEmail); showToast('Email изменён!'); closeModals(); }
        catch(err) { showToast(authErrorMsg(err.code), 'error'); }
    };

    window.changeUserPass = async () => {
        const newPass = document.getElementById('ed-new-pass').value;
        if (!newPass||newPass.length<6) return showToast('Минимум 6 символов!','error');
        try { await updatePassword(auth.currentUser, newPass); showToast('Пароль изменён!'); closeModals(); }
        catch(err) { 
            // Если требуется повторный вход
            if (err.code === 'auth/requires-recent-login') {
                showToast('Для смены пароля войдите заново или используйте восстановление через email', 'error');
                // Можно предложить восстановление через email
                setTimeout(() => {
                    if (confirm('Хотите восстановить пароль через email?')) {
                        window.openResetPasswordPage();
                    }
                }, 2000);
            } else {
                showToast(authErrorMsg(err.code), 'error');
            }
        }
    };

    window.saveProfile = async () => {
        const { userData } = getState();
        const nick = document.getElementById('ed-nick').value.trim();
        const ava  = document.getElementById('ed-ava').value.trim();
        if (!nick) return showToast('Введите никнейм!','error');
        const snap = await getDocs(query(collection(db,'users'), where('nickname','==',nick)));
        if (!snap.empty && nick !== userData.nickname) return showToast('Этот никнейм занят!','error');
        await updateDoc(doc(db,'users',auth.currentUser.uid),{ nickname: nick, avatar: ava });
        userData.nickname = nick; userData.avatar = ava;
        document.getElementById('u-nick').innerText = nick;
        document.getElementById('u-ava').src        = ava||'https://api.dicebear.com/7.x/identicon/svg';
        showToast('Профиль обновлён!'); closeModals();
    };
}


