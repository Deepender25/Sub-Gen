document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const CONFIG = {
        basePxPerSec: 100,
        minZoom: 0.1,
        maxZoom: 5,
        snapThreshold: 10
    };

    const TRACK_HEADER_WIDTH = 100; // Must match CSS .track-header width

    // --- DOM Elements ---
    const uploadSection = document.getElementById('uploadSection');
    const editorSection = document.getElementById('editorSection');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    // Video Player & Controls
    const mainVideo = document.getElementById('mainVideo');
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    const playPauseOverlay = document.getElementById('playPauseOverlay');

    // Controls Bar
    const playPauseBtn = document.getElementById('playPauseBtn');
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const totalTimeDisplay = document.getElementById('totalTimeDisplay');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // Timeline DOM
    const timelineContent = document.getElementById('timelineContent');
    const timelineScrollArea = document.getElementById('timelineScrollArea');
    const timeRuler = document.getElementById('timeRuler');
    const subtitleTrack = document.getElementById('subtitleTrack');
    const playheadContainer = document.getElementById('playheadContainer');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');

    // Style Panel
    const styleControls = document.getElementById('styleControls');
    const noSelectionMsg = document.getElementById('noSelectionMsg');
    const fontSizeInput = document.getElementById('fontSizeInput');
    const fontSizeDisplay = document.getElementById('fontSizeDisplay');
    const textColorInput = document.getElementById('textColorInput');
    const bgColorInput = document.getElementById('bgColorInput');
    const fontFamilyInput = document.getElementById('fontFamilyInput');

    const startGenerateBtn = document.getElementById('startGenerateBtn');
    const exportBtn = document.getElementById('exportBtn');
    const resetBtn = document.getElementById('resetBtn');

    // --- State ---
    let state = {
        zoom: 1,
        videoDuration: 0,
        subtitles: [],
        selectedSubtitleIndex: -1,
        isDragging: false,
        dragType: null,
        dragTargetIndex: -1,
        dragStartX: 0,
        dragPhoto: null,
        filename: null
    };

    const defaultStyle = {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        fontFamily: 'Outfit'
    };

    // --- Initialization ---
    function init() {
        bindEvents();

        // Initial Volume
        mainVideo.volume = parseFloat(volumeSlider.value);
    }

    function bindEvents() {
        // Upload
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleUpload(e.target.files[0]); });

        // Video Events
        mainVideo.addEventListener('loadedmetadata', () => {
            state.videoDuration = mainVideo.duration;
            totalTimeDisplay.textContent = formatTime(state.videoDuration);
            layoutTimeline();
        });

        mainVideo.addEventListener('timeupdate', onTimeUpdate);

        // Play/Pause
        mainVideo.addEventListener('play', () => {
            updatePlayButtonUI(true);
            startSyncLoop();
        });
        mainVideo.addEventListener('pause', () => {
            updatePlayButtonUI(false);
            stopSyncLoop();
        });
        mainVideo.addEventListener('click', togglePlay);
        playPauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

        // Volume & Fullscreen
        volumeSlider.addEventListener('input', (e) => {
            mainVideo.volume = e.target.value;
            mainVideo.muted = false;
        });
        muteBtn.addEventListener('click', toggleMute);
        fullscreenBtn.addEventListener('click', toggleFullscreen);

        // Timeline Interaction
        timelineContent.addEventListener('mousedown', onTimelineMouseDown);
        document.addEventListener('mousemove', onGlobalMouseMove);
        document.addEventListener('mouseup', onGlobalMouseUp);

        // Zoom
        zoomInBtn.addEventListener('click', () => setZoom(state.zoom * 1.25));
        zoomOutBtn.addEventListener('click', () => setZoom(state.zoom / 1.25));

        // Style Inputs
        fontSizeInput.addEventListener('input', (e) => updateSelectedStyle('fontSize', `${e.target.value}px`));
        textColorInput.addEventListener('input', (e) => updateSelectedStyle('color', e.target.value));
        bgColorInput.addEventListener('input', (e) => updateSelectedStyle('backgroundColor', e.target.value));
        fontFamilyInput.addEventListener('change', (e) => updateSelectedStyle('fontFamily', e.target.value));

        // Actions
        startGenerateBtn.addEventListener('click', generateSubtitles);
        exportBtn.addEventListener('click', exportVideo);
        resetBtn.addEventListener('click', () => location.reload());

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input,textarea')) {
                e.preventDefault();
                togglePlay();
            }
        });
    }

    // --- Sync Loop (RAF) ---
    let syncRafId = null;
    function startSyncLoop() {
        if (syncRafId) cancelAnimationFrame(syncRafId);
        function loop() {
            updatePlayheadPosition();
            if (!mainVideo.paused) syncRafId = requestAnimationFrame(loop);
        }
        loop();
    }

    function stopSyncLoop() {
        if (syncRafId) cancelAnimationFrame(syncRafId);
        updatePlayheadPosition(); // One last update to be precise
    }

    function updatePlayheadPosition() {
        const pxPerSec = getPxPerSec();
        const t = mainVideo.currentTime;
        const left = (t * pxPerSec) + TRACK_HEADER_WIDTH; // Offset for headers
        if (playheadContainer) {
            playheadContainer.style.transform = `translateX(${left}px)`;

            // Auto Scroll
            // If playhead goes > 80% screen, scroll? Or keep centered?
            // Simple auto-scroll if dragging out of view is usually needed, 
            // but for playback, keeping it in view is good.
            const scrollLeft = timelineScrollArea.scrollLeft;
            const width = timelineScrollArea.clientWidth;

            // If out of view to the right
            if (left > scrollLeft + width - 50) {
                timelineScrollArea.scrollLeft = left - 50;
            }
        }
    }

    function onTimeUpdate() {
        currentTimeDisplay.textContent = formatTime(mainVideo.currentTime);
        updateOverlay();
        // Fallback for playhead if paused or RAF fails matches here too
        if (mainVideo.paused) updatePlayheadPosition();
    }

    // --- Core Logic ---
    async function handleUpload(file) {
        if (file.size > 500 * 1024 * 1024) return alert("File too large");
        mainVideo.src = URL.createObjectURL(file);
        uploadSection.classList.add('hidden');
        editorSection.classList.remove('hidden');

        const formData = new FormData();
        formData.append('video', file);
        try {
            const res = await fetch('/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Upload Failed");
            const data = await res.json();
            state.filename = data.filename;
        } catch (err) {
            alert("Upload Error: " + err.message);
        }
    }

    async function generateSubtitles() {
        if (!state.filename) return alert("No video");
        startGenerateBtn.disabled = true;
        startGenerateBtn.innerHTML = "⏳ Generating...";

        try {
            const res = await fetch('/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: state.filename })
            });
            if (!res.ok) throw new Error("Generation Failed");

            const data = await res.json();
            state.subtitles = data.segments.map(s => ({ ...s, style: { ...defaultStyle } }));

            renderSegments();
            exportBtn.disabled = false;
            exportBtn.classList.remove('disabled');
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            startGenerateBtn.disabled = false;
            startGenerateBtn.innerHTML = "✨ Regenerate";
        }
    }

    // --- Timeline Rendering ---
    function getPxPerSec() {
        return CONFIG.basePxPerSec * state.zoom;
    }

    function setZoom(newZoom) {
        state.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, newZoom));
        layoutTimeline();
    }

    function layoutTimeline() {
        if (!state.videoDuration) return;
        const pxPerSec = getPxPerSec();
        const totalWidth = state.videoDuration * pxPerSec;
        const containerWidth = Math.max(timelineScrollArea.clientWidth, totalWidth + 200 + TRACK_HEADER_WIDTH);
        timelineContent.style.minWidth = `${containerWidth}px`;
        timelineContent.style.width = `${containerWidth}px`;

        renderRuler(pxPerSec, state.videoDuration);
        renderSegments();
        updatePlayheadPosition();
    }

    function renderRuler(pxPerSec, duration) {
        timeRuler.innerHTML = '';
        const minPxPerTick = 100;
        const tickIntervalSec = [0.1, 0.5, 1, 5, 10, 30, 60].find(i => i * pxPerSec >= minPxPerTick) || 60;

        for (let t = 0; t <= duration; t += tickIntervalSec) {
            const left = (t * pxPerSec) + TRACK_HEADER_WIDTH; // Offset for headers
            const tick = document.createElement('div');
            tick.className = 'ruler-tick major';
            tick.style.left = `${left}px`;

            const label = document.createElement('span');
            label.className = 'tick-label';
            label.textContent = formatTimeShort(t);
            tick.appendChild(label);
            timeRuler.appendChild(tick);

            if (tickIntervalSec > 1) {
                const minorCount = 4;
                const minorStep = tickIntervalSec / (minorCount + 1);
                for (let m = 1; m <= minorCount; m++) {
                    const minorT = t + (m * minorStep);
                    if (minorT > duration) break;
                    const minorTick = document.createElement('div');
                    minorTick.className = 'ruler-tick';
                    minorTick.style.left = `${(minorT * pxPerSec) + TRACK_HEADER_WIDTH}px`;
                    timeRuler.appendChild(minorTick);
                }
            }
        }
    }

    function renderSegments() {
        subtitleTrack.innerHTML = '';
        const pxPerSec = getPxPerSec();

        state.subtitles.forEach((sub, index) => {
            const el = document.createElement('div');
            el.className = `timeline-segment ${index === state.selectedSubtitleIndex ? 'selected' : ''}`;
            const left = sub.start * pxPerSec;
            const width = (sub.end - sub.start) * pxPerSec;

            el.style.left = `${left}px`;
            el.style.width = `${Math.max(width, 2)}px`;
            el.innerHTML = `
                <div class="segment-handle left" data-action="resize-l" data-index="${index}"></div>
                <span class="segment-text">${escapeHtml(sub.text)}</span>
                <div class="segment-handle right" data-action="resize-r" data-index="${index}"></div>
            `;
            el.dataset.index = index;
            el.dataset.action = "move"; // default body action
            subtitleTrack.appendChild(el);
        });
    }

    // --- Overlay & Playback UI ---
    function updateOverlay() {
        const t = mainVideo.currentTime;
        const activeSub = state.subtitles.find(s => t >= s.start && t <= s.end);
        if (activeSub) {
            subtitleOverlay.classList.remove('hidden');
            subtitleOverlay.style.display = 'block';
            subtitleOverlay.textContent = activeSub.text;

            const s = activeSub.style;
            subtitleOverlay.style.fontSize = s.fontSize;
            subtitleOverlay.style.color = s.color;
            subtitleOverlay.style.backgroundColor = s.backgroundColor;
            subtitleOverlay.style.fontFamily = s.fontFamily;
        } else {
            subtitleOverlay.style.display = 'none';
        }
    }

    function togglePlay() {
        if (mainVideo.paused) {
            mainVideo.play();
        } else {
            mainVideo.pause();
        }
    }

    function updatePlayButtonUI(isPlaying) {
        const iconPlay = playPauseBtn.querySelector('.icon-play');
        const iconPause = playPauseBtn.querySelector('.icon-pause');
        if (isPlaying) {
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            animateOverlay('play');
        } else {
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            animateOverlay('pause');
        }
    }

    function animateOverlay(type) {
        // playPauseOverlay
        playPauseOverlay.classList.remove('animate');
        void playPauseOverlay.offsetWidth;
        playPauseOverlay.classList.add('animate');
        // We could swap icon but let's keep it simple (Play triangle usually fine)
    }

    function toggleMute() {
        mainVideo.muted = !mainVideo.muted;
        // Optionally update icon opacity
        muteBtn.style.opacity = mainVideo.muted ? 0.5 : 1;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            const wrapper = document.querySelector('.video-wrapper');
            if (wrapper.requestFullscreen) wrapper.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    // --- Interaction ---
    function onTimelineMouseDown(e) {
        const target = e.target;

        // Scrubbing (Ruler or Playhead Cap)
        if (target.closest('.timeline-ruler') || target.closest('.playhead-cap')) {
            e.preventDefault();
            startDrag('scrub', -1, e);
            return;
        }

        // Segments
        if (target.closest('.timeline-segment')) {
            e.preventDefault();
            e.stopPropagation();
            const segmentEl = target.closest('.timeline-segment');
            const index = parseInt(segmentEl.dataset.index);
            let action = 'move';
            if (target.classList.contains('segment-handle')) {
                action = target.dataset.action;
            }
            selectSubtitle(index);
            startDrag(action, index, e);
        } else if (target.closest('.timeline-tracks') || target === timelineContent) {
            deselectSubtitle();
        }
    }

    function startDrag(type, index, e) {
        state.isDragging = true;
        state.dragType = type;
        state.dragTargetIndex = index;
        state.dragStartX = e.clientX;
        if (type.startsWith('segment')) {
            state.dragPhoto = { ...state.subtitles[index] };
        }
        if (type === 'scrub') {
            handleScrub(e.clientX);
        }
        document.body.style.cursor = type === 'move' ? 'grabbing' : (type === 'scrub' ? 'ew-resize' : 'col-resize');
    }

    function onGlobalMouseMove(e) {
        if (!state.isDragging) return;
        e.preventDefault();

        if (state.dragType === 'scrub') {
            handleScrub(e.clientX);
        } else if (state.dragType === 'move') {
            handleSegmentMove(e.clientX);
        } else if (state.dragType === 'resize-l' || state.dragType === 'resize-r') {
            handleSegmentResize(e.clientX);
        }
    }

    function onGlobalMouseUp() {
        if (state.isDragging) {
            state.isDragging = false;
            state.dragType = null;
            document.body.style.cursor = '';
            renderSegments(); // Snap cleanup
        }
    }

    function handleScrub(clientX) {
        const rect = timelineContent.getBoundingClientRect();
        const offsetX = clientX - rect.left - TRACK_HEADER_WIDTH; // Subtract offset
        const t = Math.max(0, Math.min(offsetX / getPxPerSec(), state.videoDuration));

        mainVideo.currentTime = t;
        // Don't rely on timeupdate for manual scrub visual
        updatePlayheadPosition();
        currentTimeDisplay.textContent = formatTime(t);
    }

    function handleSegmentMove(clientX) {
        const dx = (clientX - state.dragStartX) / getPxPerSec();
        const orig = state.dragPhoto;
        let newStart = orig.start + dx;
        let newEnd = orig.end + dx;

        // Clamp
        if (newStart < 0) { newStart = 0; newEnd = orig.end - orig.start; }
        if (newEnd > state.videoDuration) { newEnd = state.videoDuration; newStart = newEnd - (orig.end - orig.start); }

        const sub = state.subtitles[state.dragTargetIndex];
        sub.start = newStart;
        sub.end = newEnd;
        renderSegments();
    }

    function handleSegmentResize(clientX) {
        const dx = (clientX - state.dragStartX) / getPxPerSec();
        const orig = state.dragPhoto;
        const sub = state.subtitles[state.dragTargetIndex];

        if (state.dragType === 'resize-l') {
            let s = orig.start + dx;
            if (s > sub.end - 0.2) s = sub.end - 0.2;
            if (s < 0) s = 0;
            sub.start = s;
        } else {
            let e = orig.end + dx;
            if (e < sub.start + 0.2) e = sub.start + 0.2;
            if (e > state.videoDuration) e = state.videoDuration;
            sub.end = e;
        }
        renderSegments();
    }

    function selectSubtitle(index) {
        state.selectedSubtitleIndex = index;
        document.querySelectorAll('.timeline-segment').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
        styleControls.classList.remove('disabled');
        noSelectionMsg.style.display = 'none';

        const s = state.subtitles[index].style;
        fontSizeInput.value = parseInt(s.fontSize);
        fontSizeDisplay.textContent = s.fontSize;
        textColorInput.value = rgbToHex(s.color);
        bgColorInput.value = rgbToHex(s.backgroundColor);
        fontFamilyInput.value = s.fontFamily;
    }

    function deselectSubtitle() {
        state.selectedSubtitleIndex = -1;
        document.querySelectorAll('.timeline-segment').forEach(el => el.classList.remove('selected'));
        styleControls.classList.add('disabled');
        noSelectionMsg.style.display = 'block';
    }

    function updateSelectedStyle(prop, val) {
        if (state.selectedSubtitleIndex === -1) return;
        state.subtitles[state.selectedSubtitleIndex].style[prop] = val;
        if (prop === 'fontSize') fontSizeDisplay.textContent = val;
        updateOverlay();
    }

    // --- Helpers ---
    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    function formatTimeShort(s) {
        // Same as formatTime but maybe remove Hours if 0
        return formatTime(s);
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function rgbToHex(col) {
        if (col.startsWith('#')) return col;
        return '#ffffff';
    }

    async function exportVideo() {
        exportBtn.disabled = true;
        exportBtn.textContent = "Processing...";
        try {
            const res = await fetch('/export_soft_subs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: state.filename, segments: state.subtitles })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const a = document.createElement('a');
            a.href = data.download_url;
            a.download = '';
            a.click();
        } catch (e) { alert(e.message); }
        finally { exportBtn.disabled = false; exportBtn.textContent = "Export Video (Soft Subs)"; }
    }

    // Start
    init();
});
