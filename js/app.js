// js/app.js
import { db, auth } from "./firebase.js";
import { emailConfig } from "./config.js";
import { 
    collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, increment, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Инициализация EmailJS
if (window.emailjs) {
    emailjs.init({ publicKey: emailConfig.publicKey });
}

// Глобальные переменные состояния
let isAdmin = false, isDub = false, userData = null;
let allRel = [], curProj = null, curTM = null, viewAchIdx = -1;

// Вспомогательные функции (Toast, навигация и т.д.)
window.showToast = (msg, type = 'success') => {
    // Ваш код тоста...
};

window.navigate = (id, pushHistory = true) => {
    // Ваш код навигации...
};

// ... Сюда переносите все остальные функции window.loadHome, window.saveRel и т.д. ...

// Отслеживание состояния авторизации
onAuthStateChanged(auth, async (user) => {
    // Ваш код обработки авторизации...
});
