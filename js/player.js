// ============================================================
//  js/player.js — SWS Player: самостоятельный плеер
//  Поддерживает Google Drive (через /preview) и YouTube embed.
//  Подключается к releases.js и может использоваться отдельно.
// ============================================================

// ── Конфигурация плеера (редактируйте здесь) ──
export const PLAYER_CONFIG = {
    // Цвета
    accentColor:      'var(--accent)',       // цвет акцента (прогрессбар, кнопки)
    bgColor:          'rgba(0,0,0,0.92)',    // фон панели управления
    iconColor:        '#ffffff',             // цвет иконок

    // Поведение
    controlsTimeout:  3000,   // мс до скрытия управления
    seekStep:         10,     // секунд для перемотки кнопками ← →

    // Внешний вид
    borderRadius:     '16px', // скругление плеера
    showTitle:        true,   // показывать заголовок в плеере
};

// ── Состояние плеера ──
const state = {
    playing:       false,
    muted:         false,
    volume:        1,
    currentTime:   0,
    duration:      0,
    isFullscreen:  false,
    controlsTimer: null,
    isDrive:       false,  // Google Drive не поддерживает JS API
    isYoutube:     false,
    containerId:   null,
    onEnded:       null,  // callback когда видео закончилось
    onTimeUpdate:  null,  // callback для таймингов
};

// ── Утилиты ──
function pad(n) { return String(Math.floor(n)).padStart(2,'0'); }
function formatTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function getYtVideoId(url) {
    if (!url) return '';
    try {
        if (url.includes('youtube.com/watch'))  return new URL(url).searchParams.get('v') || '';
        if (url.includes('youtu.be/'))          return url.split('youtu.be/')[1]?.split('?')[0] || '';
        if (url.includes('youtube.com/embed/')) return url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    } catch(e) {}
    return '';
}

export function buildEmbedSrc(url, startSec = 0) {
    if (!url) return '';
    const ytId = getYtVideoId(url);
    if (ytId) {
        const start = startSec > 0 ? `&start=${startSec}` : '';
        return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=0${start}`;
    }
    if (url.includes('drive.google.com')) {
        return url.replace(/\/view.*$/, '/preview') + (startSec > 0 ? `#t=${startSec}` : '');
    }
    return url;
}

// ══════════════════════════════════════════════════════════════
//  ГЛАВНАЯ ФУНКЦИЯ: создать/инициализировать плеер в контейнере
// ══════════════════════════════════════════════════════════════
export function initPlayer(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    state.containerId = containerId;

    const { url = '', title = '', autoplay = false, muted = false, onEnded = null, onTimeUpdate = null } = options;
    state.onEnded      = onEnded;
    state.onTimeUpdate = onTimeUpdate;
    state.muted        = muted;

    const ytId    = getYtVideoId(url);
    const isDrive = !ytId && url.includes('drive.google.com');
    state.isDrive   = isDrive;
    state.isYoutube = !!ytId;

    // Строим embed src
    const src = buildEmbedSrc(url);

    container.innerHTML = buildPlayerHTML(src, title, isDrive, ytId, autoplay, muted);
    attachPlayerEvents(containerId, url);
}

// ── HTML структура плеера ──
function buildPlayerHTML(src, title, isDrive, ytId, autoplay, muted) {
    return `
    <div class="sws-player" id="sws-player-root">
        <!-- IFRAME (Drive или YouTube) -->
        <iframe
            class="sws-player-iframe"
            src="${src}"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
            frameborder="0"
            id="sws-iframe"
            title="${title}"></iframe>

        <!-- Оверлей: клик показывает/скрывает управление -->
        <div class="sws-overlay" id="sws-overlay">

            <!-- ЗАГОЛОВОК сверху -->
            ${title ? `<div class="sws-top-bar" id="sws-top-bar">
                <span class="sws-title">${title}</span>
            </div>` : ''}

            <!-- Центральная зона клика -->
            <div class="sws-click-zone" id="sws-click-zone"></div>

            <!-- НИЖНЯЯ ПАНЕЛЬ управления -->
            <div class="sws-controls" id="sws-controls">
                ${isDrive ? `
                <!-- Drive: только кнопка открыть в новой вкладке -->
                <div class="sws-drive-note">
                    <i class="fas fa-info-circle"></i>
                    Google Drive — управление внутри плеера Drive
                </div>` : `
                <!-- Прогрессбар -->
                <div class="sws-progress-wrap" id="sws-progress-wrap">
                    <div class="sws-progress-bg">
                        <div class="sws-progress-fill" id="sws-progress-fill"></div>
                        <div class="sws-progress-thumb" id="sws-progress-thumb"></div>
                    </div>
                    <div class="sws-time-label" id="sws-time-label">0:00 / 0:00</div>
                </div>`}

                <!-- Кнопки -->
                <div class="sws-btn-row">
                    ${isDrive ? `
                    <a class="sws-btn" href="${src.replace('/preview','')}" target="_blank" title="Открыть на Google Drive">
                        <i class="fas fa-external-link-alt"></i>
                    </a>` : `
                    <button class="sws-btn" id="sws-play-btn" title="Воспроизведение / Пауза">
                        <i class="fas fa-pause" id="sws-play-icon"></i>
                    </button>
                    <button class="sws-btn" id="sws-seek-back" title="−10 сек">
                        <i class="fas fa-undo"></i><span>10</span>
                    </button>
                    <button class="sws-btn" id="sws-seek-fwd" title="+10 сек">
                        <i class="fas fa-redo"></i><span>10</span>
                    </button>
                    <div class="sws-volume-wrap">
                        <button class="sws-btn" id="sws-mute-btn" title="Звук">
                            <i class="fas fa-volume-up" id="sws-vol-icon"></i>
                        </button>
                        <input type="range" class="sws-vol-slider" id="sws-vol-slider"
                               min="0" max="1" step="0.05" value="1">
                    </div>`}
                    <span style="flex:1;"></span>
                    <button class="sws-btn" id="sws-fs-btn" title="Полный экран">
                        <i class="fas fa-expand" id="sws-fs-icon"></i>
                    </button>
                </div>
            </div>

            <!-- Кнопки пропуска (показываются по таймингу) -->
            <button class="sws-skip-btn" id="sws-skip-intro" style="display:none;">
                <i class="fas fa-forward"></i> Пропустить заставку
            </button>
            <button class="sws-next-btn" id="sws-next-ep" style="display:none;">
                Следующая серия <i class="fas fa-step-forward"></i>
            </button>
        </div>
    </div>`;
}

// ── Привязка событий ──
function attachPlayerEvents(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const overlay   = container.querySelector('#sws-overlay');
    const controls  = container.querySelector('#sws-controls');
    const clickZone = container.querySelector('#sws-click-zone');
    const fsBtn     = container.querySelector('#sws-fs-btn');
    const fsIcon    = container.querySelector('#sws-fs-icon');
    const root      = container.querySelector('#sws-player-root');

    // ── Показать/скрыть управление по наведению/клику ──
    function showControls() {
        if (!overlay || !controls) return;
        overlay.classList.add('sws-overlay--active');
        clearTimeout(state.controlsTimer);
        state.controlsTimer = setTimeout(() => {
            overlay.classList.remove('sws-overlay--active');
        }, PLAYER_CONFIG.controlsTimeout);
    }

    if (overlay) {
        overlay.addEventListener('mousemove', showControls);
        overlay.addEventListener('touchstart', showControls, { passive: true });
    }

    // ── Клик по центральной зоне — показать управление ──
    if (clickZone) {
        clickZone.addEventListener('click', showControls);
    }

    // ── Fullscreen ──
    if (fsBtn && root) {
        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                root.requestFullscreen?.() || root.webkitRequestFullscreen?.();
                if (fsIcon) { fsIcon.className = 'fas fa-compress'; }
                state.isFullscreen = true;
            } else {
                document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                if (fsIcon) { fsIcon.className = 'fas fa-expand'; }
                state.isFullscreen = false;
            }
        });
    }

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && fsIcon) {
            fsIcon.className = 'fas fa-expand';
            state.isFullscreen = false;
        }
    });

    // ── Для YouTube: управление через постообщения недоступно без API ключа,
    //    поэтому Drive и YouTube работают через нативные iframe controls.
    //    Прогрессбар для Drive скрыт, для YouTube — информационный.
    //    Полное управление (пауза/перемотка) для iframe невозможно без
    //    YT IFrame API или Drive API — они заблокированы CORS.
    //    Поэтому кнопки управления для YouTube iframe открывают
    //    нативный плеер YouTube, а прогрессбар — визуальный.

    // Для Drive — кнопки не нужны (Drive даёт свой нативный плеер)
    // Для YouTube — управление через postMessage (YT API)
    if (state.isYoutube) {
        attachYouTubeControls(container);
    }
}

// ── YouTube постообщения (ограниченно, без API ключа) ──
function attachYouTubeControls(container) {
    // YouTube IFrame API через postMessage
    const iframe = container.querySelector('#sws-iframe');
    if (!iframe) return;

    const playBtn  = container.querySelector('#sws-play-btn');
    const playIcon = container.querySelector('#sws-play-icon');
    const muteBtn  = container.querySelector('#sws-mute-btn');
    const volIcon  = container.querySelector('#sws-vol-icon');
    const volSlider= container.querySelector('#sws-vol-slider');
    const seekBack = container.querySelector('#sws-seek-back');
    const seekFwd  = container.querySelector('#sws-seek-fwd');
    const fsBtn    = container.querySelector('#sws-fs-btn');

    function ytMsg(cmd, args = {}) {
        iframe.contentWindow?.postMessage(JSON.stringify({ event:'command', func: cmd, args: Object.values(args) }), '*');
    }

    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.playing = !state.playing;
            ytMsg(state.playing ? 'pauseVideo' : 'playVideo');
            if (playIcon) playIcon.className = state.playing ? 'fas fa-play' : 'fas fa-pause';
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.muted = !state.muted;
            ytMsg(state.muted ? 'mute' : 'unMute');
            if (volIcon) volIcon.className = state.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
        });
    }

    if (volSlider) {
        volSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            const v = parseFloat(e.target.value);
            state.volume = v;
            ytMsg('setVolume', { volume: v * 100 });
        });
    }

    // Перемотка через src обновление (единственный надёжный способ без API)
    if (seekBack) {
        seekBack.addEventListener('click', (e) => {
            e.stopPropagation();
            const m = iframe.src.match(/[?&]start=(\d+)/);
            const cur = m ? parseInt(m[1]) : 0;
            const newT = Math.max(0, cur - PLAYER_CONFIG.seekStep);
            iframe.src = iframe.src.replace(/[?&]start=\d+/, '') + `&start=${newT}`;
        });
    }
    if (seekFwd) {
        seekFwd.addEventListener('click', (e) => {
            e.stopPropagation();
            const m = iframe.src.match(/[?&]start=(\d+)/);
            const cur = m ? parseInt(m[1]) : 0;
            iframe.src = iframe.src.replace(/[?&]start=\d+/, '') + `&start=${cur + PLAYER_CONFIG.seekStep}`;
        });
    }
}

// ── API для внешнего использования ──

/** Загрузить новое видео в существующий плеер */
export function playerLoad(containerId, url, title = '', startSec = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const iframe = container.querySelector('#sws-iframe');
    if (!iframe) {
        initPlayer(containerId, { url, title });
        return;
    }
    const src = buildEmbedSrc(url, startSec);
    iframe.src = src;
    // Обновить заголовок
    const titleEl = container.querySelector('.sws-title');
    if (titleEl && title) titleEl.textContent = title;

    state.isDrive   = !getYtVideoId(url) && url.includes('drive.google.com');
    state.isYoutube = !!getYtVideoId(url);
}

/** Показать кнопку «Пропустить заставку» */
export function playerShowSkip(containerId, onSkip) {
    const btn = document.getElementById(containerId)?.querySelector('#sws-skip-intro');
    if (!btn) return;
    btn.style.display = 'flex';
    btn.onclick = () => { btn.style.display = 'none'; if (onSkip) onSkip(); };
}

/** Скрыть кнопку «Пропустить заставку» */
export function playerHideSkip(containerId) {
    const btn = document.getElementById(containerId)?.querySelector('#sws-skip-intro');
    if (btn) btn.style.display = 'none';
}

/** Показать кнопку «Следующая серия» */
export function playerShowNext(containerId, onNext) {
    const btn = document.getElementById(containerId)?.querySelector('#sws-next-ep');
    if (!btn) return;
    btn.style.display = 'flex';
    btn.onclick = () => { btn.style.display = 'none'; if (onNext) onNext(); };
}

/** Скрыть кнопку «Следующая серия» */
export function playerHideNext(containerId) {
    const btn = document.getElementById(containerId)?.querySelector('#sws-next-ep');
    if (btn) btn.style.display = 'none';
}

/** Скрыть обе кнопки */
export function playerHideAllOverlays(containerId) {
    playerHideSkip(containerId);
    playerHideNext(containerId);
}

/** Скип в позицию (только для YouTube — перезагрузка iframe) */
export function playerSeekTo(containerId, seconds) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const iframe = container.querySelector('#sws-iframe');
    if (!iframe) return;
    if (state.isYoutube) {
        const base = iframe.src.replace(/[?&]start=\d+/, '');
        iframe.src = base + `&start=${seconds}`;
    }
    // Для Drive — невозможно через iframe
}
