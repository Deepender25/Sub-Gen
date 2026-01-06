document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const uploadSection = document.getElementById('uploadSection');
    const editorSection = document.getElementById('editorSection');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    // Editor Components
    const mainVideo = document.getElementById('mainVideo');
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const timeDisplay = document.getElementById('timeDisplay');

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


    // Timeline
    const timelineWrapper = document.getElementById('timelineWrapper');
    const subtitleTrack = document.getElementById('subtitleTrack');
    const playhead = document.getElementById('playhead');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');

    // --- State ---
    let currentFilename = null;
    let subtitles = []; // Array of { start, end, text, style: {} }
    let videoDuration = 0;
    let selectedSubtitleIndex = -1;
    let zoomLevel = 1; // 1 = 100% width, 2 = 200% width

    // --- Default Style ---
    const defaultStyle = {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        fontFamily: 'Outfit'
    };

    // --- Upload Logic ---
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleUpload(e.target.files[0]);
    });

    async function handleUpload(file) {
        if (file.size > 500 * 1024 * 1024) return alert("File too large (< 500MB)");

        // 1. Setup Video
        const localUrl = URL.createObjectURL(file);
        mainVideo.src = localUrl;

        // Wait for metadata to get duration
        mainVideo.onloadedmetadata = () => {
            videoDuration = mainVideo.duration;
            timeDisplay.textContent = `00:00 / ${formatTime(videoDuration)}`;
            initTimeline();
        };

        // 2. Upload to Backend
        const formData = new FormData();
        formData.append('video', file);

        // Switch View
        uploadSection.classList.add('hidden');
        editorSection.classList.remove('hidden');

        try {
            console.log("Uploading...");
            const uploadRes = await fetch('/upload', { method: 'POST', body: formData });

            if (!uploadRes.ok) throw new Error("Upload Failed");
            const uploadData = await uploadRes.json();
            currentFilename = uploadData.filename;

            // 3. Ready for Manual Generation
            console.log("Ready for generation");

        } catch (err) {
            console.error(err);

            alert("Upload Error: " + err.message);
        }
    }

    async function generateSubtitles(filename) {
        // Show loading state if needed (optional overlay)
        try {
            console.log("Generating Subtitles...");
            const res = await fetch('/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            if (!res.ok) throw new Error("Generation Failed");
            const data = await res.json();

            // Init Subtitles with Default Styles
            subtitles = data.segments.map(seg => ({
                ...seg,
                style: { ...defaultStyle } // Clone default
            }));

            renderTimeline();

            // Enable Export
            exportBtn.disabled = false;
            exportBtn.classList.remove('disabled');
            exportBtn.textContent = "Export Video (Soft Subs)";

        } catch (err) {
            console.error(err);
            alert("Generation Error: " + err.message);
        }
    }

    // --- Timeline Logic ---
    function initTimeline() {
        // Reset zoom
        zoomLevel = 1;
        updateZoom();
    }

    function updateZoom() {
        // Adjust track container width
        const trackContainer = document.querySelector('.track-container');
        const timeRuler = document.querySelector('.time-ruler');

        // Ensure at least 100%, or more based on duration to make it usable
        // Let's say 1 second = 20px at zoom 1.
        if (videoDuration > 0) {
            const pxPerSec = 20 * zoomLevel;
            const totalWidth = videoDuration * pxPerSec;
            // Min width 100% of container
            const finalWidth = Math.max(timelineWrapper.clientWidth, totalWidth);

            trackContainer.style.width = `${finalWidth}px`;
            timeRuler.style.width = `${finalWidth}px`;

            renderRuler(pxPerSec, finalWidth);
            renderTimeline(); // Re-render segments with new pixel calculations
        }
    }

    function renderRuler(pxPerSec, totalWidth) {
        const timeRuler = document.querySelector('.time-ruler');
        timeRuler.innerHTML = '';

        // Determine tick interval based on zoom
        // If pxPerSec is small (zoomed out), show every 10s or 5s
        let interval = 1; // seconds
        if (pxPerSec < 10) interval = 10;
        else if (pxPerSec < 40) interval = 5;

        for (let t = 0; t <= videoDuration; t += interval) {
            const tick = document.createElement('div');
            tick.className = 'ruler-tick';
            tick.style.left = `${t * pxPerSec}px`;

            const label = document.createElement('span');
            label.className = 'tick-label';
            label.textContent = formatTimeShort(t);

            tick.appendChild(label);
            timeRuler.appendChild(tick);
        }
    }

    function formatTimeShort(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    zoomInBtn.addEventListener('click', () => { zoomLevel = Math.min(zoomLevel * 1.5, 5); updateZoom(); });
    zoomOutBtn.addEventListener('click', () => { zoomLevel = Math.max(zoomLevel / 1.5, 0.5); updateZoom(); });

    function renderTimeline() {
        subtitleTrack.innerHTML = '';
        if (videoDuration === 0) return;

        const pxPerSec = 20 * zoomLevel;

        subtitles.forEach((seg, index) => {
            const el = document.createElement('div');
            el.className = 'timeline-segment';
            if (index === selectedSubtitleIndex) el.classList.add('selected');

            // Calculate Position in Pixels
            const left = seg.start * pxPerSec;
            const width = (seg.end - seg.start) * pxPerSec;

            el.style.left = `${left}px`;
            el.style.width = `${Math.max(width, 2)}px`; // Min width visibility
            el.textContent = seg.text;

            // Interaction
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSubtitle(index);
            });

            subtitleTrack.appendChild(el);
        });
    }

    // Scrubbing Logic
    timelineWrapper.addEventListener('click', (e) => {
        // Seek to position
        if (videoDuration === 0) return;

        const rect = timelineWrapper.querySelector('.track-container').getBoundingClientRect();
        // Calculate click position relative to the scrollable container content
        const x = e.clientX - rect.left;
        const totalWidth = rect.width;

        const percent = x / totalWidth;
        // But totalWidth is strictly related to duration now
        // Time = px / pxPerSec
        const pxPerSec = 20 * zoomLevel;
        const seekTime = x / pxPerSec;

        if (seekTime >= 0 && seekTime <= videoDuration) {
            mainVideo.currentTime = seekTime;
            // Only deselect if we didn't click a segment (handled by stopProp above)
            if (!e.target.classList.contains('timeline-segment')) {
                deselect();
            }
        }
    });

    // --- Selection & Style Logic ---
    function selectSubtitle(index) {
        selectedSubtitleIndex = index;

        // Update Timeline Visuals
        document.querySelectorAll('.timeline-segment').forEach((el, idx) => {
            if (idx === index) el.classList.add('selected');
            else el.classList.remove('selected');
        });

        // Seek Video
        mainVideo.currentTime = subtitles[index].start;

        // Enable Panel
        styleControls.classList.remove('disabled');
        noSelectionMsg.style.display = 'none';

        // Populate Inputs
        const s = subtitles[index].style || defaultStyle;

        // Parse values (fontSize '24px' -> 24)
        fontSizeInput.value = parseInt(s.fontSize);
        fontSizeDisplay.textContent = s.fontSize;
        textColorInput.value = rgbToHex(s.color); // Handle mapping if needed
        bgColorInput.value = rgbToHex(s.backgroundColor);
        fontFamilyInput.value = s.fontFamily;

        // Force immediate overlay update
        renderOverlay();
    }

    // Input Listeners
    fontSizeInput.addEventListener('input', (e) => {
        if (selectedSubtitleIndex === -1) return;
        const val = `${e.target.value}px`;
        fontSizeDisplay.textContent = val;
        subtitles[selectedSubtitleIndex].style.fontSize = val;
        renderOverlay();
    });

    textColorInput.addEventListener('input', (e) => {
        if (selectedSubtitleIndex === -1) return;
        subtitles[selectedSubtitleIndex].style.color = e.target.value;
        renderOverlay();
    });

    bgColorInput.addEventListener('input', (e) => {
        if (selectedSubtitleIndex === -1) return;
        // Ensure rgba output if opacity desired, input type color gives hex
        subtitles[selectedSubtitleIndex].style.backgroundColor = e.target.value;
        renderOverlay();
    });

    fontFamilyInput.addEventListener('change', (e) => {
        if (selectedSubtitleIndex === -1) return;
        subtitles[selectedSubtitleIndex].style.fontFamily = e.target.value;
        renderOverlay();
    });

    // Global Click to Deselect - handled by Scrubbing listener now


    function deselect() {
        selectedSubtitleIndex = -1;
        document.querySelectorAll('.timeline-segment').forEach(el => el.classList.remove('selected'));
        styleControls.classList.add('disabled');
        noSelectionMsg.style.display = 'block';
    }

    // --- Video Player & Overlay ---
    playPauseBtn.addEventListener('click', () => {
        if (mainVideo.paused) mainVideo.play();
        else mainVideo.pause();
    });

    mainVideo.addEventListener('play', () => playPauseBtn.textContent = '⏸');
    mainVideo.addEventListener('pause', () => playPauseBtn.textContent = '⏯');

    mainVideo.addEventListener('timeupdate', () => {
        const t = mainVideo.currentTime;
        timeDisplay.textContent = `${formatTime(t)} / ${formatTime(videoDuration)}`;

        // Update Playhead
        if (videoDuration > 0) {
            const pxPerSec = 20 * zoomLevel;
            const leftPx = t * pxPerSec;
            playhead.style.left = `${leftPx}px`;

            // Auto scroll logic (optional but nice)
            // If playhead moves out of view, scroll wrapper
            const wrapper = document.getElementById('timelineWrapper');
            const center = wrapper.clientWidth / 2;
            if (leftPx > center) {
                wrapper.scrollLeft = leftPx - center;
            }
        }

        renderOverlay();
    });

    function renderOverlay() {
        const t = mainVideo.currentTime;

        // Find active segment
        const activeSeg = subtitles.find(s => t >= s.start && t <= s.end);

        if (activeSeg) {
            subtitleOverlay.textContent = activeSeg.text;
            subtitleOverlay.classList.remove('hidden');

            // Apply Styles
            const s = activeSeg.style || defaultStyle;
            subtitleOverlay.style.fontSize = s.fontSize;
            subtitleOverlay.style.color = s.color;
            subtitleOverlay.style.backgroundColor = s.backgroundColor;
            subtitleOverlay.style.fontFamily = s.fontFamily;

            // Base styles
            subtitleOverlay.className = 'subtitle-overlay'; // Reset class
            subtitleOverlay.style.display = 'block';

            // We apply most styles to the container or an inner span?
            // The HTML has `div#subtitleOverlay`. We can style that directly.
            // But we need to make sure text shadow/outline looks good.

        } else {
            subtitleOverlay.classList.add('hidden');
            subtitleOverlay.style.display = 'none';
        }
    }

    // --- Helpers ---
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "00:00";
        const date = new Date(seconds * 1000);
        return date.toISOString().substr(14, 5); // MM:SS
    }

    // Simple hex helper (Inputs return hex, so we just use hex)
    function rgbToHex(col) {
        if (col.startsWith('#')) return col;
        // Basic fallback for now
        return '#000000';
    }

    // --- Generation & Export ---
    startGenerateBtn.addEventListener('click', () => {
        if (!currentFilename) return alert("Please upload a video first");

        startGenerateBtn.disabled = true;
        startGenerateBtn.innerHTML = "⏳ Generating...";

        generateSubtitles(currentFilename).finally(() => {
            startGenerateBtn.disabled = false;
            startGenerateBtn.innerHTML = "✨ Regenerate Subtitles";
        });
    });

    exportBtn.addEventListener('click', async () => {
        if (!currentFilename || subtitles.length === 0) return;

        const originalText = exportBtn.textContent;
        exportBtn.disabled = true;
        exportBtn.textContent = "Processing Export...";

        try {
            const res = await fetch('/export_soft_subs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentFilename,
                    segments: subtitles
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Export failed");

            // Download
            const link = document.createElement('a');
            link.href = data.download_url;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            alert("Export Error: " + err.message);
        } finally {
            exportBtn.disabled = false;
            exportBtn.textContent = originalText;
        }
    });

    resetBtn.addEventListener('click', () => {

        location.reload();
    });
});
