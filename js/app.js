// ============================================================
//  js/app.js — Точка входа, инициализация Firebase и модулей
// ============================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore }     from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc }      from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { FIREBASE_CONFIG, EMAILJS_CONFIG } from '../config/config.js';
import { navigate, showToast, closeModals } from './core.js';
import { initAuthListeners, applyUserUI, resetUserUI } from './auth.js';
import { loadReleases, filterData, openView, rateProj, openRelModal, saveRel, deleteRel } from './releases.js';
import { loadTeam, openTeamPage, openTeamModal, saveTeam, delTeam } from './team.js';
import { loadComments, sendComment, delComm } from './comments.js';
import { openUserProfile, openUserProfileByName, showMySubscribers, openRoleModal } from './users.js';
import { renderAchProfile, giveAch } from './achievements.js';
import { initDubinPanel, renderDubinProjects } from './dubin.js';

// ── Инициализация Firebase ──
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Инициализация EmailJS ──
if (window.emailjs) emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

// ── Состояние приложения ──
let userData = null;
let isAdmin  = false;
let isDub    = false;

// ── Привязываем глобальные функции с контекстом (db, auth, userData, ...) ──
// Это необходимо, т.к. HTML-атрибуты onclick вызывают window.*

window.navigate       = navigate;
window.closeModals    = closeModals;

window.filterData     = () => filterData(isAdmin);
window.openView       = (id) => openView(db, auth, id, userData, isAdmin);
window.rateProj       = (type) => rateProj(db, auth, curProj, userData, type);
window.openRelModal   = (id) => openRelModal(db, id);
window.saveRel        = () => saveRel(db);
window.deleteRel      = (id) => deleteRel(db, id);

window.loadTeam       = () => loadTeam(db, isAdmin, userData);
window.openTeamPage   = (id) => openTeamPage(db, id, isAdmin, userData);
window.openTeamModal  = (id) => openTeamModal(db, id);
window.saveTeam       = () => saveTeam(db);
window.delTeam        = (id) => delTeam(db, id);

window.sendComment    = () => sendComment(db, auth, window._curProj, userData);
window.delComm        = (id) => delComm(db, auth, window._curProj, id);

window.openUserProfile       = (uid) => openUserProfile(db, auth, userData, uid);
window.openUserProfileByName = (nick) => openUserProfileByName(db, auth, userData, nick);
window.showMySubscribers     = () => showMySubscribers(db, auth);
window.openRoleModal         = () => openRoleModal();
window.assignRole            = () => assignRole(db);

window.giveAch = () => giveAch(db, userData);
window.openAchInventory = () => window._openAchInventory(userData);
window.toggleAchVisibility = (idx) => window._toggleAchVisibility(db, auth, userData, idx);
window.viewAch = (idx) => window._viewAch(userData, idx);
window.deleteAchievement = () => window._deleteAchievement(db, auth, userData);

window.openDubinProjectModal = (id) => window._openDubinProjectModal(db, id);
window.saveDubinProject = () => window._saveDubinProject(db);
window.deleteDubinProject = (id) => window._deleteDubinProject(db, id);
window.openUploadVoice = (id) => window._openUploadVoice(id);
window.submitVoiceFile = () => window._submitVoiceFile(db, auth, userData);
window.deleteVoiceFile = (proj, idx) => window._deleteVoiceFile(db, proj, idx);
window.sendSuggestion  = () => window._sendSuggestion(db, auth, userData);
window.savePriv        = () => window._savePriv(db);

window.saveProfile    = () => window._saveProfile(auth, db, userData);
window.changeUserEmail = () => window._changeUserEmail(auth);
window.changeUserPass  = () => window._changeUserPass(auth);
window.resetPassword   = () => window._resetPassword(auth);
window.saveTP          = () => window._saveTP(db);
window.openMyTPEdit    = () => window._openMyTPEdit(userData);
window.saveMyTP        = () => window._saveMyTP(db, userData);
window.openAccessModal = () => window._openAccessModal();
window.grantCardAccess = () => window._grantCardAccess(db);

// ── Auth State ──
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db,'users',user.uid));
        if (snap.exists()) {
            userData = snap.data();
            isAdmin  = userData.role === 'admin';
            isDub    = userData.role === 'dub' || isAdmin;
            applyUserUI(user, userData, isAdmin, isDub);
        }
    } else {
        userData = null; isAdmin = false; isDub = false;
        resetUserUI();
    }

    // Загружаем данные после определения роли
    await loadReleases(db);
    initAuthListeners(auth, db);

    const hashPage = window.location.hash.replace('#','') || 'home';
    if (hashPage === 'dubin' && !isDub) navigate('home', false);
    else navigate(hashPage, false);
});

// ── Навигация при клике назад/вперёд в браузере ──
window.addEventListener('popstate', () => {
    const page = window.location.hash.replace('#','') || 'home';
    navigate(page, false);
});

// ── При переходе на section "team" — загружаем данные ──
const origNavigate = navigate;
window.navigate = function(page, pushState = true) {
    origNavigate(page, pushState);
    if (page === 'team') loadTeam(db, isAdmin, userData);
    if (page === 'dubin') {
        initDubinPanel(isAdmin, isDub);
        if (isDub) renderDubinProjects(db, isAdmin);
    }
};
