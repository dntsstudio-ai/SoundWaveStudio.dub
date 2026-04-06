// ============================================================
//  js/achievements.js — Достижения пользователей
// ============================================================

import {
    doc, getDocs, updateDoc, collection, query, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals } from './core.js';

let viewAchIdx = -1;

// ── Отрисовка достижений в профиле ──
export function renderAchProfile(userData) {
    if (!userData) return;
    const el = document.getElementById('u-ach');
    if (!el) return;
    const achs = userData.achievements || [];
    el.innerHTML = achs.filter(a => !a.hidden).map((a, i) =>
        `<div style="background:var(--input-bg);padding:10px;border-radius:10px;font-size:22px;cursor:pointer;border:1px solid var(--border);"
              title="${esc(a.name)}" onclick="viewAch(${i})">${a.img}</div>`
    ).join('') || '<p style="font-size:12px;color:var(--text-dim);">Пока нет достижений.</p>';
}

// ── Привязка всех функций достижений к актуальному состоянию ──
export function bindAchievements(db, auth, getState) {

    // Инвентарь достижений
    window.openAchInventory = () => {
        const { userData } = getState();
        const achs = userData.achievements || [];
        document.getElementById('ach-inv-list').innerHTML = achs.map((a, i) =>
            `<div style="background:var(--input-bg);padding:12px;border-radius:10px;text-align:center;cursor:pointer;
                  border:1px solid ${a.hidden ? 'red' : 'var(--accent)'};opacity:${a.hidden ? '0.5' : '1'};transition:0.2s;"
                  onclick="toggleAchVisibility(${i})">
                <div style="font-size:26px;margin-bottom:5px;">${a.img}</div>
                <div style="font-size:10px;font-weight:bold;">${esc(a.name)}</div>
                <div style="font-size:9px;color:var(--text-dim);margin-top:4px;text-decoration:underline;"
                     onclick="event.stopPropagation();viewAch(${i})">Подробнее</div>
            </div>`
        ).join('');
        document.getElementById('m-ach-inv').style.display = 'flex';
    };

    // Переключить видимость ачивки
    window.toggleAchVisibility = async (idx) => {
        const { userData } = getState();
        userData.achievements[idx].hidden = !userData.achievements[idx].hidden;
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { achievements: userData.achievements });
        window.openAchInventory();
        renderAchProfile(userData);
    };

    // Просмотр ачивки
    window.viewAch = (idx) => {
        const { userData } = getState();
        viewAchIdx = idx;
        const a = userData.achievements[idx];
        document.getElementById('ach-v-img').innerText  = a.img;
        document.getElementById('ach-v-name').innerText = a.name;
        document.getElementById('ach-v-desc').innerText = a.desc;
        document.getElementById('ach-v-meta').innerHTML =
            `<b>Получено:</b> ${new Date(a.date).toLocaleDateString()}<br><b>От:</b> ${a.giver || 'Система/Студия'}`;
        document.getElementById('btn-ach-del').style.display = 'block';
        document.getElementById('m-ach-inv').style.display   = 'none';
        document.getElementById('m-ach-view').style.display  = 'flex';
    };

    // Удалить ачивку
    window.deleteAchievement = async () => {
        if (!confirm('Удалить достижение НАВСЕГДА?')) return;
        const { userData } = getState();
        userData.achievements.splice(viewAchIdx, 1);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { achievements: userData.achievements });
        showToast('Достижение удалено!'); closeModals(); renderAchProfile(userData);
    };

    // Выдача ачивки (Admin)
    window.giveAch = async () => {
        const { userData } = getState();
        const email = document.getElementById('ga-uid').value.trim();
        const snap  = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
        if (snap.empty) return showToast('Пользователь не найден!', 'error');
        const uRef = doc(db, 'users', snap.docs[0].id);
        const achs = [...(snap.docs[0].data().achievements || [])];
        achs.push({
            name:   document.getElementById('ga-name').value,
            desc:   document.getElementById('ga-desc').value,
            img:    document.getElementById('ga-img').value,
            date:   Date.now(),
            hidden: false,
            giver:  userData.nickname
        });
        await updateDoc(uRef, { achievements: achs });
        showToast('Достижение выдано!'); closeModals();
    };
}
