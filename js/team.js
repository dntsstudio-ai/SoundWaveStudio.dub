// ============================================================
//  js/team.js — Команда студии: список, страница участника
// ============================================================

import {
    collection, getDocs, getDoc, doc, addDoc,
    updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals, navigate } from './core.js';
import { PLACEHOLDER_TEAM_IMG } from '../config/config.js';

export let curTM = null;

// ── Загрузка команды ──
export async function loadTeam(db, isAdmin, userData) {
    const snap = await getDocs(query(collection(db,'team'), orderBy('order')));
    const t    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const cats = {};
    t.forEach(m => { const c = m.cat||'Без категории'; if(!cats[c]) cats[c]=[]; cats[c].push(m); });

    const w = document.getElementById('team-wrapper');
    w.innerHTML = '';
    Object.keys(cats).forEach(cat => {
        const cDiv = document.createElement('div');
        cDiv.className = 'team-container';
        cDiv.innerHTML = `
            <div class="team-container-header" onclick="const g=this.nextElementSibling; g.style.display=g.style.display==='none'?'grid':'none'">
                ${esc(cat)} <i class="fas fa-chevron-down" style="font-size:11px;"></i>
            </div>
            <div class="grid" id="cat-${cat.replace(/\s/g,'')}"></div>`;
        w.appendChild(cDiv);

        const grid = cDiv.querySelector('.grid');
        grid.innerHTML = cats[cat].map(m => `
            <div class="card" data-id="${m.id}" onclick="openTeamPage('${m.id}')">
                <div class="drag-handle"><i class="fas fa-grip-lines"></i> Перетащить</div>
                ${isAdmin ? `<div class="adm-tools">
                    <button class="btn-sm" style="background:#3897f0;" onclick="event.stopPropagation(); openTeamModal('${m.id}')">Ред</button>
                    <button class="btn-sm" style="background:#ef4444;" onclick="event.stopPropagation(); delTeam('${m.id}')">Удал</button>
                </div>` : ''}
                <img src="${esc(m.img)}" loading="lazy" style="width:100%; height:230px; object-fit:cover;" onerror="this.src='${PLACEHOLDER_TEAM_IMG}'">
                <div class="card-info" style="text-align:center;">
                    <div class="card-title" style="font-size:14px;">${esc(m.name)}</div>
                    <div style="color:var(--accent); font-size:11px; margin-top:5px; font-weight:bold;">${esc(m.role)}</div>
                </div>
            </div>`).join('');

        if (isAdmin && window.Sortable) {
            new Sortable(grid, {
                handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
                onEnd: async () => {
                    const items = Array.from(grid.children);
                    for (let i=0; i<items.length; i++)
                        await updateDoc(doc(db,'team',items[i].dataset.id), { order: i });
                    showToast('Порядок сохранён');
                }
            });
        }
    });
    if (isAdmin) document.body.classList.add('admin-mode');
    else document.body.classList.remove('admin-mode');
}

export async function saveTeam(db) {
    const id   = document.getElementById('ed-team-id').value;
    const data = {
        name: document.getElementById('ad-m-name').value,
        role: document.getElementById('ad-m-role').value,
        img:  document.getElementById('ad-m-img').value,
        cat:  document.getElementById('ad-m-cat').value || 'Без категории'
    };
    if (!id) { data.order = 999; await addDoc(collection(db,'team'), data); }
    else await updateDoc(doc(db,'team',id), data);
    closeModals(); loadTeam(db, true, null); showToast('Участник сохранён!');
}

// ── Страница участника ──
export async function openTeamPage(db, id, isAdmin, userData) {
    const cardSnap = await getDoc(doc(db,'team',id));
    curTM = { id, ...cardSnap.data() };
    navigate('team-page');

    document.getElementById('adm-tp-controls').style.display = isAdmin ? 'flex' : 'none';
    const isLinked = userData && userData.linkedCardId === id;
    document.getElementById('own-tp-controls').style.display = (isLinked && !isAdmin) ? 'flex' : 'none';

    document.getElementById('team-page-view').innerHTML = `
        <div style="display:flex; gap:28px; align-items:flex-start; flex-wrap:wrap;">
            <img src="${esc(curTM.img)}" style="width:230px; height:320px; border-radius:14px; object-fit:cover; border:2px solid var(--accent); box-shadow:var(--shadow);" onerror="this.src='${PLACEHOLDER_TEAM_IMG}'">
            <div style="flex:1; min-width:280px;">
                <h1 style="font-size:2.2rem; margin-bottom:8px;">${esc(curTM.name)}</h1>
                <h3 style="color:var(--accent); margin-bottom:18px;">${esc(curTM.role)}</h3>
                <div style="background:var(--input-bg); padding:18px; border-radius:10px; border:1px solid var(--border); margin-bottom:18px;">
                    <h4 style="margin-bottom:8px; color:var(--text-dim);">О себе:</h4>
                    <p style="line-height:1.6; font-size:14px; white-space:pre-wrap;">${esc(curTM.bio||'Информация пока не добавлена.')}</p>
                </div>
                ${curTM.social ? `<a href="${esc(curTM.social)}" target="_blank" class="btn btn-outline" style="text-decoration:none;"><i class="fas fa-link"></i> Соцсети</a>` : ''}
            </div>
        </div>`;
}
