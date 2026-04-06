// ============================================================
//  js/app.js — Точка входа. Инициализация Firebase + модулей.
//
//  Исправления по сравнению с оригиналом:
//  1. Единое хранилище state передаётся во все модули через getState()
//  2. Все window.* регистрируются через bind-функции — нет window._* паттернов
//  3. navigate переопределён один раз, корректно триггерит loadTeam/dubin
//  4. onAuthStateChanged обновляет state и перерисовывает UI
//  5. curProj синхронизируется через state после openView
// ============================================================

import { initializeApp }             from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG, EMAILJS_CONFIG } from '../config/config.js';
import { navigate, closeModals, showToast }    from './core.js';
import { initAuthListeners, applyUserUI, resetUserUI, bindAuthActions } from './auth.js';
import { renderAchProfile, bindAchievements }  from './achievements.js';
import { loadReleases, bindReleases }          from './releases.js';
import { bindComments }                        from './comments.js';
import { bindTeam }                            from './team.js';
import { bindUsers }                           from './users.js';
import { initDubinPanel, bindDubin }           from './dubin.js';

// ── Firebase ──
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── EmailJS ──
if (window.emailjs) emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

// ── Центральное хранилище состояния ──
const state = {
    userData: null,
    isAdmin:  false,
    isDub:    false,
    curProj:  null   // текущий открытый релиз (нужен комментариям, лайкам)
};
const getState = () => state;

// ── Регистрируем все window.* через bind-функции модулей ──
bindReleases(db, auth, getState);
bindComments(db, auth, getState);
bindTeam(db, getState);
bindUsers(db, auth, getState);
bindAchievements(db, auth, getState);
bindDubin(db, auth, getState);
bindAuthActions(auth, db, getState);

// ── Глобальные утилиты из HTML ──
window.closeModals = closeModals;
window.showToast   = showToast;

// ── Navigate с загрузкой данных при переходе ──
window.navigate = (page, pushState = true) => {
    navigate(page, pushState);
    if (page === 'team')  window.loadTeam();
    if (page === 'dubin') {
        initDubinPanel(state.isAdmin, state.isDub);
        if (state.isDub) window.renderDubinProjects();
    }
};

// ── Перехватываем openView, чтобы записать curProj в state ──
// (нужно до onAuthStateChanged, т.к. bindReleases уже зарегистрировал openView)
const _origOpenView = window.openView;
window.openView = async (id) => {
    await _origOpenView(id);
    // releases.js экспортирует curProj — читаем через динамический импорт
    const relMod = await import('./releases.js');
    state.curProj = relMod.curProj;
};

// ── Auth State — главный цикл приложения ──
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                state.userData = snap.data();
                state.isAdmin  = state.userData.role === 'admin';
                state.isDub    = state.userData.role === 'dub' || state.isAdmin;
                applyUserUI(state.userData, state.isAdmin, state.isDub);
                renderAchProfile(state.userData);
            } else {
                resetUserUI();
            }
        } catch (e) {
            console.error('Ошибка загрузки профиля:', e);
            resetUserUI();
        }
    } else {
        state.userData = null;
        state.isAdmin  = false;
        state.isDub    = false;
        resetUserUI();
    }

    // Загружаем релизы (isAdmin влияет на кнопки Ред/Удал)
    await loadReleases(db, state.isAdmin);

    // Переход по хэшу
    const hashPage = window.location.hash.replace('#', '') || 'home';
    if (hashPage === 'dubin' && !state.isDub) window.navigate('home', false);
    else window.navigate(hashPage, false);
});

// ── Инициализируем кнопки входа/регистрации/выхода ──
initAuthListeners(auth, db);

// ── Кнопки «назад/вперёд» браузера ──
window.addEventListener('popstate', () => {
    const page = window.location.hash.replace('#', '') || 'home';
    window.navigate(page, false);
});
