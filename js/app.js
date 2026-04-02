import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG } from '../config/config.js';
import { navigate, showToast, closeModals } from './core.js';
import { initAuthListeners, applyUserUI, resetUserUI } from './auth.js';
import { loadReleases, filterData, openView, openPrivacy, saveRel, deleteRel, openRelModal } from './releases.js';
import { loadTeam, openTeamPage } from './team.js';
import { sendComment, delComm } from './comments.js';
import { openUserProfile, openUserProfileByName, assignRole, openRoleModal } from './users.js';
import { viewAch, openAchInventory, giveAch } from './achievements.js';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

let userData = null, isAdmin = false, isDub = false;

// Экспортируем функции в глобальную область видимости (window)
window.navigate = navigate;
window.closeModals = closeModals;
window.filterData = () => filterData(isAdmin);
window.openView = (id) => openView(db, auth, id, isAdmin, userData);
window.openRelModal = (id) => openRelModal(db, id);
window.saveRel = () => saveRel(db);
window.deleteRel = (id) => deleteRel(db, id);
window.openPrivacy = () => openPrivacy(db, isAdmin);
window.openTeamPage = (id) => openTeamPage(db, id, isAdmin, userData);
window.sendComment = () => sendComment(db, auth, userData); 
window.viewAch = (idx) => viewAch(userData, idx);
window.openAchInventory = () => openAchInventory(userData);
window.giveAch = () => giveAch(db);
window.openUserProfile = (uid) => openUserProfile(db, auth, userData, uid);
window.openUserProfileByName = (name) => openUserProfileByName(db, auth, userData, name);
window.openRoleModal = openRoleModal;
window.assignRole = () => assignRole(db);

// Слушатель состояния входа
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
    
    // Навигация по хэшу
    const page = window.location.hash.replace('#', '') || 'home';
    navigate(page, false);
});

window.addEventListener('popstate', () => {
    const page = window.location.hash.replace('#', '') || 'home';
    navigate(page, false);
});
