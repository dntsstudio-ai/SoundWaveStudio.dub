// js/team.js
import { collection, getDocs, getDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { esc, showToast, closeModals, navigate } from './core.js';
import { PLACEHOLDER_TEAM_IMG } from '../config/config.js';

export let curTM = null;

export async function loadTeam(db, isAdmin, userData) {
    const snap = await getDocs(query(collection(db,'team'), orderBy('order')));
    const t = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const cats = {};
    t.forEach(m => { const c = m.cat||'Без категории'; if(!cats[c]) cats[c]=[]; cats[c].push(m); });

    const w = document.getElementById('team-wrapper');
    if(!w) return;
    w.innerHTML = '';
    Object.keys(cats).forEach(cat => {
        const cDiv = document.createElement('div');
        cDiv.className = 'team-container';
        cDiv.innerHTML = `<div class="team-container-header">${esc(cat)}</div>`;
        const grid = document.createElement('div');
        grid.className = 'team-grid';
        grid.innerHTML = cats[cat].map(m => `
            <div class="team-card" onclick="openTeamPage('${m.id}')">
                <img src="${m.img || PLACEHOLDER_TEAM_IMG}">
                <div class="team-card-name">${esc(m.name)}</div>
                <div class="team-card-role">${esc(m.role)}</div>
            </div>
        `).join('');
        cDiv.appendChild(grid);
        w.appendChild(cDiv);
    });
}

export async function openTeamPage(db, id, isAdmin, userData) {
    const snap = await getDoc(doc(db,'team',id));
    if(!snap.exists()) return;
    curTM = { id: snap.id, ...snap.data() };
    
    document.getElementById('tp-img').src = curTM.img || PLACEHOLDER_TEAM_IMG;
    document.getElementById('tp-name').innerText = curTM.name;
    document.getElementById('tp-role').innerText = curTM.role;
    document.getElementById('tp-bio').innerText = curTM.bio || 'Информации пока нет.';
    
    // Кнопка редактирования для админа или владельца
    const canEdit = isAdmin || (userData && userData.cardPerms && userData.cardPerms.targetId === id);
    document.getElementById('btn-tp-edit').style.display = canEdit ? 'block' : 'none';
    
    navigate('team-page');
}
