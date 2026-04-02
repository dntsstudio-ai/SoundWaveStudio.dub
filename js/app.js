import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG } from '../config/config.js';
import { navigate, showToast, closeModals } from './core.js';
import { initAuthListeners, applyUserUI, resetUserUI } from './auth.js';
import { loadReleases, filterData, openView, deleteRel, openPrivacy } from './releases.js';
import { openUserProfile, assignRole, openRoleModal } from './users.js';
import { viewAch, openAchInventory, giveAch } from './achievements.js';
import { sendComment } from './comments.js';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

let userData = null, isAdmin = false, isDub = false;

// ПРИВЯЗКА К WINDOW (Чтобы HTML видел эти функции)
window.navigate = navigate;
window.closeModals = closeModals;
window.filterData = filterData;
window.openView = (id) => openView(db, auth, id, isAdmin, userData);
window.deleteRel = (id) => deleteRel(db, id);
window.openPrivacy = () => openPrivacy(db, isAdmin);
window.openUserProfile = (uid) => openUserProfile(db, auth, userData, uid);
window.openRoleModal = openRoleModal;
window.assignRole = () => assignRole(db);
window.viewAch = (idx) => viewAch(userData, idx);
window.openAchInventory = () => openAchInventory(userData);
window.giveAch = () => giveAch(db);
window.sendComment = () => sendComment(db, auth, userData);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            userData = snap.data();
            isAdmin = userData.role === 'admin';
            isDub = userData.role === 'dub' || isAdmin;
            applyUserUI(user, userData, isAdmin, isDub);
        }
    } else {
        userData = null; isAdmin = false; isDub = false;
        resetUserUI();
    }
    await loadReleases(db);
    initAuthListeners(auth, db);

    const page = window.location.hash.replace('#', '') || 'home';
    navigate(page, false);
});
