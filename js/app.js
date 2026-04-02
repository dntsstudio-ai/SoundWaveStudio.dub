// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG } from '../config/config.js';
import { navigate, showToast, closeModals } from './core.js';
import { initAuthListeners, applyUserUI, resetUserUI } from './auth.js';
import { loadReleases, filterData, openView, openPrivacy } from './releases.js';
import { loadTeam, openTeamPage } from './team.js';
import { loadComments, sendComment, delComm } from './comments.js';
import { openUserProfile, openUserProfileByName, assignRole } from './users.js';

const app  = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

let userData = null, isAdmin = false, isDub = false;

// ── МОСТ ДЛЯ HTML (Решает ошибку n.indexOf) ──
window.navigate = navigate;
window.closeModals = closeModals;

window.loadReleases = () => loadReleases(db);
window.filterData   = () => filterData();
window.openView     = (id) => openView(db, auth, id, isAdmin, userData);
window.openPrivacy  = () => openPrivacy(db, isAdmin);

window.loadTeam     = () => loadTeam(db, isAdmin, userData);
window.openTeamPage = (id) => openTeamPage(db, id, isAdmin, userData);

window.sendComment  = () => sendComment(db, auth, userData);
window.openUserProfile = (uid) => openUserProfile(db, auth, userData, uid);
window.openUserProfileByName = (name) => openUserProfileByName(db, auth, userData, name);

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
    
    await loadReleases(db);
    if (window.location.hash === '#team') loadTeam(db, isAdmin, userData);
});

window.addEventListener('popstate', () => {
    const page = window.location.hash.replace('#','') || 'home';
    navigate(page, false);
});
