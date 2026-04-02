import { collection, getDocs, getDoc, doc, updateDoc, query, orderBy, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { esc, showToast, navigate } from './core.js';
import { loadComments } from './comments.js';

const PLACEHOLDER_IMG = 'https://via.placeholder.com/300x450?text=SWS';
export let allRel = [];

export async function loadReleases(db) {
    const snap = await getDocs(query(collection(db, 'releases'), orderBy('timestamp', 'desc')));
    allRel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filterData();
}

export function filterData() {
    let res = [...allRel];
    const q = document.getElementById('main-search')?.value.toLowerCase();
    const g = document.getElementById('filter-genre')?.value;
    const s = document.getElementById('filter-sort')?.value;

    if (q) res = res.filter(r => r.title?.toLowerCase().includes(q));
    if (g && g !== 'all') res = res.filter(r => r.genre === g);
    if (s === 'pop') res.sort((a, b) => (b.views || 0) - (a.views || 0));

    const grid = document.getElementById('releases-grid');
    if (!grid) return;
    grid.innerHTML = res.map(r => `
        <div class="rel-card" onclick="openView('${r.id}')">
            <img src="${r.img || PLACEHOLDER_IMG}" class="rel-img">
            <div class="rel-info">
                <div class="rel-title">${esc(r.title)}</div>
                <div style="font-size:12px; color:var(--text-dim);">${esc(r.genre)} • ${r.year}</div>
            </div>
        </div>
    `).join('');
}

export async function openView(db, auth, id, isAdmin, userData) {
    const snap = await getDoc(doc(db, 'releases', id));
    if (!snap.exists()) return;
    const curProj = { id: snap.id, ...snap.data() };

    await updateDoc(doc(db, 'releases', id), { views: increment(1) });

    document.getElementById('v-img').src = curProj.img || PLACEHOLDER_IMG;
    document.getElementById('v-title').innerText = curProj.title;
    document.getElementById('v-desc').innerText = curProj.desc;
    document.getElementById('v-meta').innerText = `${curProj.year} • ${curProj.genre} • 👀 ${curProj.views || 0}`;

    const epCont = document.getElementById('v-episodes');
    epCont.innerHTML = (curProj.episodes || []).map((e, i) => `
        <div class="ep-row" onclick="window.open('${e.link}', '_blank')">
            <span>Серия ${i + 1}: ${esc(e.name)}</span>
            <i class="fas fa-play-circle"></i>
        </div>
    `).join('') || '<p>Серии скоро появятся</p>';

    document.getElementById('adm-rel-edit').style.display = isAdmin ? 'block' : 'none';
    loadComments(db, auth, curProj, userData, isAdmin);
    navigate('view');
}
