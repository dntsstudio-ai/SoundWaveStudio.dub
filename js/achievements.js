import { doc, updateDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { esc, showToast, closeModals } from './core.js';

let viewAchIdx = -1;

export function renderAchProfile(userData) {
    if (!userData) return;
    const achs = userData.achievements || [];
    const container = document.getElementById('u-ach');
    if (!container) return;
    container.innerHTML = achs.filter(a => !a.hidden).map((a, i) =>
        `<div style="background:var(--input-bg); padding:10px; border-radius:10px; font-size:22px; cursor:pointer; border:1px solid var(--border);" title="${esc(a.name)}" onclick="viewAch(${i})">${a.img}</div>`
    ).join('') || '<p style="font-size:12px; color:var(--text-dim);">Пока нет достижений.</p>';
}

export function viewAch(userData, idx) {
    const a = userData.achievements[idx];
    if (!a) return;
    viewAchIdx = idx;
    document.getElementById('ach-v-img').innerHTML = a.img;
    document.getElementById('ach-v-name').innerText = a.name;
    document.getElementById('ach-v-desc').innerText = a.desc;
    document.getElementById('ach-v-meta').innerHTML = `<b>Получено:</b> ${new Date(a.date).toLocaleDateString()}<br><b>От:</b> ${a.giver || 'Система'}`;
    document.getElementById('m-ach-view').style.display = 'flex';
}

export function openAchInventory(userData) {
    const achs = userData.achievements || [];
    document.getElementById('ach-inv-list').innerHTML = achs.map((a, i) => `
        <div style="background:var(--input-bg); padding:12px; border-radius:12px; display:flex; align-items:center; gap:15px; border:1px solid var(--border);">
            <div style="font-size:30px;">${a.img}</div>
            <div style="flex:1;">
                <div style="font-weight:bold;">${esc(a.name)}</div>
                <div style="font-size:11px; color:var(--text-dim);">${esc(a.desc)}</div>
            </div>
            <button class="btn-sm" onclick="viewAch(${i})">Инфо</button>
        </div>
    `).join('') || '<p>Инвентарь пуст</p>';
    document.getElementById('m-ach-inv').style.display = 'flex';
}

export async function giveAch(db) {
    const email = document.getElementById('ga-uid').value.trim();
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    if (snap.empty) return showToast('Пользователь не найден!', 'error');
    
    const uRef = doc(db, 'users', snap.docs[0].id);
    const achs = [...(snap.docs[0].data().achievements || [])];
    achs.push({
        name: document.getElementById('ga-name').value,
        desc: document.getElementById('ga-desc').value,
        img: document.getElementById('ga-img').value,
        date: Date.now(),
        giver: 'АДМИНИСТРАЦИЯ'
    });
    await updateDoc(uRef, { achievements: achs });
    showToast('Достижение выдано!');
}
