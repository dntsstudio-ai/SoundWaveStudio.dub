// ============================================================
//  js/comments.js — Комментарии к релизам
// ============================================================

import {
    collection, getDocs, addDoc, deleteDoc,
    doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast } from './core.js';
import { openUserProfile } from './users.js';

// ── Загрузка комментариев ──
export async function loadComments(db, auth, curProj, userData, isAdmin) {
    const snap = await getDocs(
        query(collection(db, `releases/${curProj.id}/comments`), orderBy('time','desc'))
    );
    document.getElementById('comm-count').innerText = snap.size;
    document.getElementById('comm-list').innerHTML = snap.docs.map(d => {
        const c = d.data();
        const text = esc(c.text).replace(/@([\wа-яА-ЯёЁ]+)/g,
            `<a href="#" class="mention-link" onclick="openUserProfileByName('$1'); return false;">@$1</a>`);
        return `<div class="comm-item">
            <img src="${esc(c.ava)||'https://api.dicebear.com/7.x/identicon/svg'}" class="comm-ava" style="cursor:pointer;" onclick="openUserProfile('${c.uid}')">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                    <b style="font-size:14px; cursor:pointer;" onclick="openUserProfile('${c.uid}')">${esc(c.nick)}</b>
                    <span style="font-size:10px; color:var(--text-dim);">${new Date(c.time).toLocaleString()}</span>
                </div>
                <p style="font-size:13px; margin-top:5px; word-break:break-word; line-height:1.5;">${text}</p>
                ${(isAdmin||(userData&&c.uid===auth.currentUser.uid))
                    ? `<button class="btn-sm" style="background:transparent; color:red; margin-top:5px; padding:0;" onclick="delComm('${d.id}')">Удалить</button>`
                    : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Отправка комментария ──
export async function sendComment(db, auth, curProj, userData) {
    const txt = document.getElementById('comm-text').value.trim();
    if (!txt || !userData) return;
    await addDoc(collection(db, `releases/${curProj.id}/comments`), {
        uid: auth.currentUser.uid, nick: userData.nickname,
        ava: userData.avatar||'', text: txt, time: Date.now()
    });
    document.getElementById('comm-text').value = '';
    loadComments(db, auth, curProj, userData, false);
    showToast('Комментарий отправлен!');
}
window.sendComment = sendComment;

// ── Удаление комментария ──
export async function delComm(db, auth, curProj, id) {
    if (!confirm('Удалить комментарий?')) return;
    await deleteDoc(doc(db, `releases/${curProj.id}/comments`, id));
    loadComments(db, auth, curProj, null, true);
    showToast('Удалено');
}
window.delComm = delComm;
