// ============================================================
//  js/achievements.js — Достижения пользователей
// ============================================================

import {
    doc, getDoc, getDocs, updateDoc, collection, query, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals } from './core.js';

let viewAchIdx = -1;

};
    await updateDoc(uRef, { achievements: achs });
    showToast('Достижение выдано!'); closeModals();
};
