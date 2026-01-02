document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadSection = document.getElementById('uploadSection');
    const editorSection = document.getElementById('editorSection');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const videoContainer = document.querySelector('.video-container'); // Note: selector might need adjustment if class used
    const mainVideo = document.getElementById('mainVideo');
    const subtitleList = document.getElementById('subtitleList');
    const processingOverlay = document.getElementById('processingOverlay');
    const generateBtn = document.getElementById('generateBtn');
    const postProcessActions = document.getElementById('postProcessActions');
    const burnBtn = document.getElementById('burnBtn');
    const downloadSrtBtn = document.getElementById('downloadSrtBtn');
    const resetBtn = document.getElementById('resetBtn');
    const subtitleCount = document.getElementById('subtitleCount');

    // State
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

    // Step 1: Handle Upload
    async function handleUpload(file) {
        if (file.size > 500 * 1024 * 1024) { // 500MB limit
            alert("File too large. Please upload < 500MB");
            return;
        }

        const formData = new FormData();
        formData.append('video', file);

        // Show player immediately for local review
        mainVideo.src = URL.createObjectURL(file);

        // Transition to Step 2
        uploadSection.classList.add('hidden');
        uploadSection.classList.remove('active');
        editorSection.classList.remove('hidden');
        editorSection.classList.add('active'); // You might want to define .active in CSS for step-section if needed, or just rely on hidden removal

        try {
            const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) throw new Error(uploadData.error);

            currentFilename = uploadData.filename;
            console.log("File uploaded:", currentFilename);

        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
            resetApp();
        }
    }

    // Step 2: Generate Subtitles
    generateBtn.addEventListener('click', async () => {
        if (!currentFilename) return;

        // UI Updates
        processingOverlay.classList.remove('hidden');
        generateBtn.classList.add('hidden');

        try {
            const processRes = await fetch('/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: currentFilename })
            });

            const processData = await processRes.json();
            if (!processRes.ok) throw new Error(processData.error);

            subtitles = processData.segments;

            // Update UI with results
            if (processData.language) {
                const langBadge = document.getElementById('detectedLanguage');
                langBadge.textContent = processData.language.toUpperCase();
                langBadge.classList.remove('hidden');
            }

            renderSubtitles();

            // Show Post-Process Actions
            postProcessActions.classList.remove('hidden');
            postProcessActions.style.display = 'flex'; // Ensure flex layout

        } catch (err) {
            console.error(err);
            alert("Generation failed: " + err.message);
            generateBtn.classList.remove('hidden'); // Show button again on error
        } finally {
            processingOverlay.classList.add('hidden');
        }
    });

    // Step 3: Actions

    // Download SRT
    downloadSrtBtn.addEventListener('click', async () => {
        if (!currentFilename || !subtitles.length) return;

        const originalText = downloadSrtBtn.innerHTML;
        downloadSrtBtn.textContent = 'Saving...';
        downloadSrtBtn.disabled = true;

        try {
            const res = await fetch('/save_srt', {
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
            const link = document.createElement('a');
            link.href = data.download_url;
            link.download = ''; // Browser handles name
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            alert("Error saving SRT: " + err.message);
        } finally {
            downloadSrtBtn.innerHTML = originalText;
            downloadSrtBtn.disabled = false;
        }
    });

    // Burn Video
    burnBtn.addEventListener('click', async () => {
        if (!currentFilename) return;

        const originalText = burnBtn.innerHTML;
        burnBtn.innerHTML = "Processing...";
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

            window.location.href = data.download_url;

        } catch (err) {
            alert("Error burning subtitles: " + err.message);
        } finally {
            burnBtn.innerHTML = originalText;
            burnBtn.disabled = false;
        }
    });

    // Reset App
    resetBtn.addEventListener('click', resetApp);

    function resetApp() {
        // Reset State
        currentFilename = null;
        subtitles = [];
        mainVideo.src = '';

        // Reset DOM
        fileInput.value = '';
        subtitleList.innerHTML = '<div class="empty-state"><p>Click "Generate Subtitles" to start AI transcription.</p></div>';
        subtitleCount.textContent = '0';
        document.getElementById('detectedLanguage').classList.add('hidden');

        // Toggle Sections
        editorSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        uploadSection.classList.add('active');

        // Reset Buttons
        generateBtn.classList.remove('hidden');
        postProcessActions.classList.add('hidden');
        postProcessActions.style.display = 'none';
    }

    // Helper: Render Subtitles
    function renderSubtitles() {
        subtitleList.innerHTML = '';
        subtitleCount.textContent = subtitles.length;

        if (!subtitles || subtitles.length === 0) {
            console.warn("No subtitles to render");
            return;
        }

        subtitles.forEach((seg, index) => {
            console.log(`Segment ${index}:`, seg); // Debug info

            const el = document.createElement('div');
            el.className = 'subtitle-item';
            el.dataset.index = index;

            // Click to seek
            el.addEventListener('click', () => {
                mainVideo.currentTime = seg.start;
                mainVideo.play();
            });

            const startStr = formatTime(seg.start);
            const endStr = formatTime(seg.end);

            // Use safe value assignment
            let textContent = seg.text ? seg.text.trim() : "";

            // DEBUG: Explicitly mark empty text
            if (!textContent) {
                textContent = "[NO SPEECH DETECTED]";
            }

            el.innerHTML = `
                <div class="timestamps">${startStr} - ${endStr}</div>
                <textarea class="subtitle-text" placeholder="Enter subtitle text..."></textarea>
            `;

            const textarea = el.querySelector('textarea');
            textarea.value = textContent; // Set value directly

            // Auto-resize function
            const autoResize = (target) => {
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
            };

            // Initial resize
            // Timeout ensures DOM is painted before calculating height
            setTimeout(() => autoResize(textarea), 0);

            // Sync Edits & Resize
            textarea.addEventListener('input', (e) => {
                subtitles[index].text = e.target.value;
                autoResize(e.target);
            });

            // Prevent seek preventing text selection
            textarea.addEventListener('click', (e) => e.stopPropagation());

            subtitleList.appendChild(el);
        });
    }

    function formatTime(seconds) {
        return new Date(seconds * 1000).toISOString().substr(11, 8);
    }

    // Sync Active Highlighting
    mainVideo.addEventListener('timeupdate', () => {
        const time = mainVideo.currentTime;
        document.querySelectorAll('.subtitle-item').forEach((el, idx) => {
            const seg = subtitles[idx];
            if (seg && time >= seg.start && time <= seg.end) {
                if (!el.classList.contains('active')) {
                    el.classList.add('active');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                el.classList.remove('active');
            }
        });
    });
});

