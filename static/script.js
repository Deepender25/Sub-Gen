document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const videoContainer = document.getElementById('videoContainer');
    const mainVideo = document.getElementById('mainVideo');
    const subtitleList = document.getElementById('subtitleList');
    const processingOverlay = document.getElementById('processingOverlay');
    const burnBtn = document.getElementById('burnBtn');

    let currentFilename = null;
    let subtitles = [];

    // Drag & Drop
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleUpload(e.target.files[0]);
        }
    });

    async function handleUpload(file) {
        if (file.size > 500 * 1024 * 1024) { // 500MB limit
            alert("File too large. Please upload < 500MB");
            return;
        }

        const formData = new FormData();
        formData.append('video', file);

        // Show player immediately for local review (blob)
        mainVideo.src = URL.createObjectURL(file);
        videoContainer.classList.remove('hidden');
        uploadZone.classList.add('hidden');

        // Show processing state on side panel
        processingOverlay.classList.remove('hidden');

        try {
            // 1. Upload
            const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) throw new Error(uploadData.error);

            currentFilename = uploadData.filename;

            // 2. Process
            const processRes = await fetch('/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: currentFilename })
            });

            const processData = await processRes.json();
            if (!processRes.ok) throw new Error(processData.error);

            subtitles = processData.segments;

            // Show detected language
            if (processData.language) {
                const langBadge = document.getElementById('detectedLanguage');
                langBadge.textContent = processData.language.toUpperCase();
                langBadge.classList.remove('hidden');
            }

            renderSubtitles();
            processingOverlay.classList.add('hidden');
            burnBtn.disabled = false;

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
            processingOverlay.classList.add('hidden');
        }
    }

    function renderSubtitles() {
        subtitleList.innerHTML = '';
        subtitles.forEach((seg, index) => {
            const el = document.createElement('div');
            el.className = 'subtitle-item';
            el.dataset.index = index;
            el.onclick = () => {
                mainVideo.currentTime = seg.start;
                mainVideo.play();
            };

            const startStr = formatTime(seg.start);
            const endStr = formatTime(seg.end);

            el.innerHTML = `
                <div class="timestamps">${startStr} - ${endStr}</div>
                <textarea class="subtitle-text" rows="2">${seg.text.trim()}</textarea>
            `;

            // Auto-resize textarea
            const textarea = el.querySelector('textarea');
            textarea.addEventListener('input', (e) => {
                subtitles[index].text = e.target.value;
            });

            // Prevent seek on text click
            textarea.onclick = (e) => e.stopPropagation();

            subtitleList.appendChild(el);
        });
    }

    function formatTime(seconds) {
        return new Date(seconds * 1000).toISOString().substr(11, 8);
    }

    // Burn Video
    burnBtn.addEventListener('click', async () => {
        if (!currentFilename) return;

        const originalText = burnBtn.innerText;
        burnBtn.innerText = "Processing...";
        burnBtn.disabled = true;

        try {
            const res = await fetch('/burn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentFilename,
                    segments: subtitles
                })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            // Trigger download
            window.location.href = data.download_url;

        } catch (err) {
            alert("Error burning subtitles: " + err.message);
        } finally {
            burnBtn.innerText = originalText;
            burnBtn.disabled = false;
        }
    });

    // Highlight active subtitle
    mainVideo.addEventListener('timeupdate', () => {
        const time = mainVideo.currentTime;
        document.querySelectorAll('.subtitle-item').forEach((el, idx) => {
            const seg = subtitles[idx];
            if (time >= seg.start && time <= seg.end) {
                el.classList.add('active');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                el.classList.remove('active');
            }
        });
    });
});
