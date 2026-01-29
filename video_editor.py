import ffmpeg
import os
import re

def build_subtitle_entries(segments, style_config):
    """
    Build subtitle entries based on display mode.
    This mirrors the frontend buildSubtitleEntries() logic.
    
    Returns a list of dicts with: text, start, end
    """
    entries = []
    display_mode = style_config.get('displayMode', 'sentence')
    words_per_line = style_config.get('wordsPerLine', 3)
    
    for segment in segments:
        seg_start = segment.get('start', 0)
        seg_end = segment.get('end', 0)
        seg_text = segment.get('text', '').strip()
        words = segment.get('words', [])
        
        # Sentence mode: one entry per segment
        if display_mode == 'sentence':
            entries.append({
                'text': seg_text,
                'start': seg_start,
                'end': seg_end
            })
            continue
        
        # If no word-level data, fallback to sentence
        if not words:
            entries.append({
                'text': seg_text,
                'start': seg_start,
                'end': seg_end
            })
            continue
        
        # Word mode: one entry per word
        if display_mode == 'word':
            for i, word in enumerate(words):
                word_text = word.get('word', '').strip()
                word_start = word.get('start', seg_start)
                
                # Extend word duration to fill gap (prevents flashing)
                if i + 1 < len(words):
                    next_start = words[i + 1].get('start', seg_end)
                    word_end = min(next_start, seg_end)
                else:
                    word_end = seg_end
                
                entries.append({
                    'text': word_text,
                    'start': word_start,
                    'end': word_end
                })
            continue
        
        # Phrase mode: group words into chunks
        if display_mode == 'phrase':
            current_chunk = []
            chunk_start = words[0].get('start', seg_start) if words else seg_start
            
            for i, word in enumerate(words):
                word_text = word.get('word', '').strip()
                
                if not current_chunk:
                    chunk_start = word.get('start', seg_start)
                
                current_chunk.append(word_text)
                
                # Break conditions
                has_punctuation = bool(re.search(r'[.?!,;:]', word_text))
                should_break = len(current_chunk) >= words_per_line or (has_punctuation and len(current_chunk) > 1)
                is_last = i == len(words) - 1
                
                if should_break or is_last:
                    # Extend chunk duration to fill gap
                    if i + 1 < len(words):
                        next_start = words[i + 1].get('start', seg_end)
                        chunk_end = min(next_start, seg_end)
                    else:
                        chunk_end = seg_end
                    
                    entries.append({
                        'text': ' '.join(current_chunk),
                        'start': chunk_start,
                        'end': chunk_end
                    })
                    current_chunk = []
    
    return entries

def generate_srt(segments, output_path):
    """
    Generates an SRT subtitle file from Whisper segments.
    """
    def format_timestamp(seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

    with open(output_path, 'w', encoding='utf-8') as f:
        for i, segment in enumerate(segments, start=1):
            start = format_timestamp(segment['start'])
            end = format_timestamp(segment['end'])
            text = segment['text'].strip()
            
            f.write(f"{i}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{text}\n\n")

    return output_path

def hex_to_ass_color(hex_color, opacity=1.0):
    """
    Converts hex color (#RRGGBB) to ASS format (&HAABBGGRR).
    opacity: 0.0 (transparent) to 1.0 (opaque). 
    In ASS, alpha is 00 (opaque) to FF (transparent).
    """
    if not hex_color or not hex_color.startswith('#'):
        return '&H00FFFFFF' # Default white
    
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
    else:
        return '&H00FFFFFF'

    # Calculate alpha: 1.0 opacity -> 0 alpha. 0.0 opacity -> 255 alpha.
    alpha = int((1.0 - opacity) * 255)
    alpha_hex = f"{alpha:02X}"
    
    # ASS color is BBGGRR
    return f"&H{alpha_hex}{b}{g}{r}"

def get_video_info(video_path):
    try:
        probe = ffmpeg.probe(video_path)
        video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
        return video_stream
    except ffmpeg.Error as e:
        print(f"Probe error: {e.stderr}")
        return None

def generate_ass_file(subtitles, style_config, output_path, video_width=1920, video_height=1080):
    """
    Generates an ASS subtitle file from segments and style config.
    Uses build_subtitle_entries() to properly handle displayMode.
    """
    # Build entries based on displayMode (word/phrase/sentence)
    entries = build_subtitle_entries(subtitles, style_config)
    
    # Font Fallback
    style_font = style_config.get("fontFamily", "Arial")
    if os.path.exists(os.path.join(os.getcwd(), f"{style_font}.ttf")):
        font_name = style_font
    elif os.path.exists(os.path.join(os.getcwd(), f"{style_font}.otf")):
         font_name = style_font
    else:
        font_name = "Arial"
        print(f"WARN: Font '{style_font}' not found. Falling back to Arial.")

    font_size = style_config.get("fontSize", 48)
    text_color = style_config.get("color", "#FFFFFF")
    primary_color = hex_to_ass_color(text_color)
    
    bg_color_hex = style_config.get("backgroundColor", "#000000")
    bg_opacity = style_config.get("backgroundOpacity", 0.6)
    back_color = hex_to_ass_color(bg_color_hex, bg_opacity)
    
    outline_color = hex_to_ass_color(style_config.get("strokeColor", "#000000"))
    
    # Alignment (Default Bottom Center = 2)
    alignment = 2 
    
    # Calculate MarginV based on yAlign percent
    y_align_percent = style_config.get('yAlign', 75)
    margin_v = int(video_height * (1.0 - (y_align_percent / 100.0)))
    
    # Font weight
    font_weight = style_config.get('fontWeight', '400')
    bold = 1 if int(font_weight) >= 600 else 0
    
    # Construct Style String
    border_style = 3 if style_config.get("backgroundColor") else 1
    outline_width = 0 if border_style == 3 else 2 
    
    style_line = f"Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{outline_color},{back_color},{bold},0,0,0,100,100,0,0,{border_style},{outline_width},0,{alignment},20,20,{margin_v},1"
    
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    
    def format_time_ass(seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centis = int((seconds - int(seconds)) * 100)
        return f"{hours}:{minutes:02}:{secs:02}.{centis:02}"

    # Use pre-built entries directly
    for entry in entries:
        start = format_time_ass(entry['start'])
        end = format_time_ass(entry['end'])
        text = entry['text'].replace('\n', '\\N')
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(events))
        
    return output_path

def burn_subtitles(video_path, subtitle_path, output_path, style_config=None):
    """
    Burns subtitles into the video using FFmpeg with optional styling.
    Uses ASS format for rich styling.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    
    # Clean up any previous temp files if they exist (optional, mostly done in finally)
    
    try:
        # 1. Get Video Info for Resolution
        video_info = get_video_info(video_path)
        width = int(video_info['width']) if video_info else 1920
        height = int(video_info['height']) if video_info else 1080
        
        # 2. Convert SRT/Segments to ASS
        # We need the segments. If we only have SRT path, we entered via the old way.
        # But 'subtitle_path' here is passed from app.py.
        # Ideally, app.py should pass the segments to burn_subtitles if we want to generate ASS.
        # OR, we parse the SRT. Parsing SRT is extra work.
        # Let's assume for now we must generate ASS from the segments if available.
        # Wait, the signature of this function takes `subtitle_path` (SRT). 
        # Refactoring to take segments would be better, but let's see if we can maintain compat.
        # If we act responsibly, `video_editor.burn_subtitles` should probably accept `segments` instead of `subtitle_path` if we want to rebuild ASS.
        # However, looking at app.py: `video_editor.burn_subtitles(input_path, srt_path, output_path, style_config)`
        # It DOES NOT pass segments.
        # I MUST UPDATE app.py to pass segments OR I must parse the SRT.
        # Updating app.py is cleaner.
        # For this step, I will implement `_burn_ass` helper and update this function to expect `segments` arg if possible, 
        # OR I will just parse the SRT here if segments are missing.
        # actually, let's keep it simple: I will modify app.py to pass segments.
        # usage in `burn_subtitles`: if `style_config` is present, we assume we want ASS.
        # But wait, `burn_subtitles` currently receives `subtitle_path`.
        # I will change the signature to `burn_subtitles(video_path, subtitle_path, output_path, style_config=None, segments=None)`
        pass 
        
        # NOTE: I am writing the logic inside the tool call, so I need to be complete.
        # I realized I need to change the function signature, but I can't easily change callers in the same tool call if they are in different files.
        # But I can handle `segments=None` and fail or fallback.
        
    except Exception as e:
        print(f"Error prep: {e}")
        return False
        
    # ... Implementation continues below in the actual replacement ...
    return False # Placeholder for thought process

# Actual Replacement Content Construction
# I will rewrite the whole function to be robust and handle the "local ffmpeg" requirement.

def burn_subtitles(video_path, subtitle_path, output_path, style_config=None, segments=None):
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    # Check for local FFmpeg
    ffmpeg_binary = "ffmpeg" # Default system path
    local_ffmpeg = os.path.join(os.getcwd(), "ffmpeg.exe")
    if os.path.exists(local_ffmpeg):
        # We can't easily tell ffmpeg-python to use a specific binary without monkeypatching or setting env var
        # Set PATH to include CWD
        os.environ["PATH"] = os.getcwd() + os.pathsep + os.environ["PATH"]
        # Also could explicit check, but putting in PATH is easiest for ffmpeg-python
        
    video_info = get_video_info(video_path)
    width = int(video_info['width']) if video_info else 1920
    height = int(video_info['height']) if video_info else 1080

    ass_path = None
    
    if style_config and segments:
        # Generate ASS file
        ass_filename = f"temp_{os.path.basename(video_path)}_{style_config.get('fontFamily', 'font')}.ass"
        ass_path = os.path.join(os.getcwd(), ass_filename) # Use root for FFmpeg safety
        generate_ass_file(segments, style_config, ass_path, width, height)
        burn_source = ass_path
        burn_filter = f"ass='{os.path.basename(ass_path)}'"
    else:
        # Fallback to SRT if no segments/style
        burn_source = subtitle_path
        # Use root copy trick for SRT too if needed, but ASS is preferred
        # Re-use the temp copy logic for SRT context
        temp_srt_name = "temp_burn_root.srt"
        temp_srt_path = os.path.join(os.getcwd(), temp_srt_name)
        import shutil
        shutil.copy2(subtitle_path, temp_srt_path)
        burn_source = temp_srt_path
        burn_filter = f"subtitles='{os.path.basename(temp_srt_path)}'"
        
        if style_config:
            # Legacy Force Style support (if ASS gen fails or not used)
            font_size = style_config.get('fontSize', 24)
            primary_color = hex_to_ass_color(style_config.get('color', '#ffffff'))
            back_color = hex_to_ass_color(style_config.get('backgroundColor', '#000000'), style_config.get('backgroundOpacity', 0.6))
            margin_v = 50 # simplified
            force_style = f"FontSize={font_size},PrimaryColour={primary_color},BackColour={back_color},BorderStyle=3,Outline=0,Shadow=0,Alignment=2,MarginV={margin_v}"
            burn_filter += f":force_style='{force_style}'"

    # DEBUG LOGGING
    with open("burn_debug.log", "a", encoding="utf-8") as log:
        log.write(f"\n--- New Burn Request (ASS Mode) ---\n")
        log.write(f"Source: {burn_source}\n")
        log.write(f"Filter: {burn_filter}\n")

    try:
        stream = ffmpeg.input(video_path)
        stream = ffmpeg.output(stream, output_path, vf=burn_filter)
        
        # Log command
        try:
             cmd = ffmpeg.compile(stream, overwrite_output=True)
             with open("burn_debug.log", "a", encoding="utf-8") as log:
                 log.write(f"FFmpeg Command: {cmd}\n")
        except:
             pass

        ffmpeg.run(stream, overwrite_output=True, capture_stderr=True)
        return True
            
    except ffmpeg.Error as e:
        err_msg = e.stderr.decode('utf8') if e.stderr else str(e)
        print(f"FFmpeg error: {err_msg}")
        with open("burn_debug.log", "a", encoding="utf-8") as log:
            log.write(f"FFmpeg FAILURE (Stderr):\n{err_msg}\n")
        return False
        
    except Exception as e:
        print(f"General Error: {e}")
        with open("burn_debug.log", "a", encoding="utf-8") as log:
            log.write(f"General Failure: {e}\n")
        return False
        
    finally:
        # Cleanup
        try:
            # DEBUG: Keep ASS file for inspection
            if ass_path and os.path.exists(ass_path):
                 print(f"DEBUG: Kept ASS file at {ass_path}")
                 # with open(ass_path, 'r', encoding='utf-8') as f:
                 #    print(f"DEBUG: ASS Content Preview:\n{f.read()}")
            
            if 'temp_srt_path' in locals() and os.path.exists(temp_srt_path):
                os.remove(temp_srt_path)
        except Exception as e:
            print(f"Cleanup error: {e}")

def generate_subtitle_images(subtitles, style_config, output_dir, video_width=1920, video_height=1080):
    """
    Generates PNG images for each subtitle using Playwright to render HTML/CSS.
    Returns a list of tuples: (image_path, start_time, end_time)
    """
    from playwright.sync_api import sync_playwright
    import tempfile
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Style Extraction
    font_family = style_config.get('fontFamily', 'Arial')
    font_size = style_config.get('fontSize', 48)
    color = style_config.get('color', '#ffffff')
    bg_color = style_config.get('backgroundColor', '#000000') 
    # Frontend sends hex #RRGGBB. We need to parse opacity.
    # Actually, frontend sends hex. Opacity is separate 'backgroundOpacity'.
    # But React style is `rgba(...)`.
    # Let's convert hex to rgb for css.
    def hex_to_rgb(hex_val):
        hex_val = hex_val.lstrip('#')
        return tuple(int(hex_val[i:i+2], 16) for i in (0, 2, 4))
    
    bg_r, bg_g, bg_b = hex_to_rgb(bg_color)
    bg_opacity = style_config.get('backgroundOpacity', 0.6)
    bg_rgba = f"rgba({bg_r}, {bg_g}, {bg_b}, {bg_opacity})"
    
    font_weight = style_config.get('fontWeight', 'normal')
    y_align = style_config.get('yAlign', 85) # Percentage from top
    
    # HTML Template
    # mimic the frontend structure exactly
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Cinzel:wght@400;700&family=Comfortaa:wght@300;400;700&family=Courier+Prime:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:wght@400;700&family=Fjalla+One&family=Fredoka:wght@300;400;600&family=Inter:wght@300;400;600;800&family=Lato:wght@300;400;700&family=Lobster&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:wght@300;400;700&family=Montserrat:wght@300;400;600;800&family=Open+Sans:wght@300;400;600;800&family=Oswald:wght@300;400;700&family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Permanent+Marker&family=Poppins:wght@300;400;600;800&family=Raleway:wght@300;400;700&family=Righteous&family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;700&family=Rubik:wght@300;400;600&family=Space+Grotesk:wght@300;400;500;600;700&family=Work+Sans:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body, html {{ margin: 0; padding: 0; width: {video_width}px; height: {video_height}px; background: transparent; overflow: hidden; }}
        #container {{
            position: absolute;
            width: 100%;
            top: {y_align}%;
            display: flex;
            justify-content: center;
            text-align: center;
            pointer-events: none;
        }}
        #text {{
            font-family: '{font_family}', sans-serif;
            font-size: {font_size}px;
            color: {color};
            background-color: {bg_rgba};
            font-weight: {font_weight};
            padding: 0.25em 0.5em;
            border-radius: 0.4em;
            max-width: 90%;
            line-height: 1.4;
            text-shadow: 0 2px 8px rgba(0,0,0,0.5);
            display: inline;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }}
    </style>
    </head>
    <body>
        <div id="container">
            <span id="text"></span>
        </div>
    </body>
    </html>
    """
    
    temp_html = os.path.join(output_dir, "template.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    image_map = []
    
    # Use unified build_subtitle_entries for consistent timing
    render_items = build_subtitle_entries(subtitles, style_config)

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': video_width, 'height': video_height})
        page.goto(f"file:///{temp_html}")
        
        # Inject style for pre-wrap if needed
        page.add_style_tag(content="#text { white-space: pre-wrap; }")

        for i, item in enumerate(render_items):
            # item is from build_subtitle_entries with keys: text, start, end
            raw_text = item['text'].strip()
            # Escape quotes and newlines for JS
            safe_text = raw_text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

            # Update DOM
            page.evaluate(f'document.getElementById("text").innerText = "{safe_text}";')
            
            # Dynamic Resizing Logic (Inject JS)
            # Ensures text fits within 94% width and doesn't vertically overflow
            page.evaluate("""
                (function() {
                    const text = document.getElementById('text');
                    const bodyW = document.body.clientWidth;
                    const bodyH = document.body.clientHeight;
                    
                    // Reset to base style from CSS
                    text.style.fontSize = ''; 
                    
                    let size = parseFloat(window.getComputedStyle(text).fontSize);
                    
                    // Safety break
                    let iterations = 0;
                    while (size > 8 && iterations < 50) {
                        const rect = text.getBoundingClientRect();
                        const isTooWide = rect.width > bodyW * 0.94;
                        const isTooTall = rect.bottom > bodyH || rect.top < 0; 
                        
                        if (!isTooWide && !isTooTall) {
                            break; 
                        }
                        
                        size *= 0.9; // Shrink by 10%
                        text.style.fontSize = size + 'px';
                        iterations++;
                    }
                })()
            """)
            
            # Screenshot
            img_filename = f"sub_{i:04d}.png"
            img_path = os.path.join(output_dir, img_filename)
            page.screenshot(path=img_path, omit_background=True)
            
            image_map.append({
                'path': img_path,
                'start': item['start'],
                'end': item['end']
            })
            
        browser.close()
        
    return image_map

def burn_subtitles(video_path, subtitle_path, output_path, style_config=None, segments=None):
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    # Check for local FFmpeg
    ffmpeg_binary = "ffmpeg" # Default system path
    local_ffmpeg = os.path.join(os.getcwd(), "ffmpeg.exe")
    if os.path.exists(local_ffmpeg):
        os.environ["PATH"] = os.getcwd() + os.pathsep + os.environ["PATH"]

    video_info = get_video_info(video_path)
    width = int(video_info['width']) if video_info else 1920
    height = int(video_info['height']) if video_info else 1080

    # --- STRATEGY 1: IMAGE BURN (Playwright -> PNG -> MOV -> Overlay) ---
    # Preferred for complex styles (gradients, rounded backgrounds, emojis)
    use_image_burn = True 
    
    if use_image_burn and segments and style_config:
        try:
            import shutil
            import subprocess
            
            print("--- Starting Image Burn Strategy ---")
            
            # Create temp dir for images
            # Use unique name to support concurrent requests
            import uuid
            temp_dir = os.path.join(os.getcwd(), f"temp_frames_{uuid.uuid4().hex[:8]}")
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            os.makedirs(temp_dir)
            
            print(f"Generating subtitle images in {temp_dir}...")
            image_map = generate_subtitle_images(segments, style_config, temp_dir, width, height)
            print(f"Generated {len(image_map)} images.")
            
            if len(image_map) > 0:
                # Create 'inputs.txt' for concat demuxer
                concat_file = os.path.join(temp_dir, "inputs.txt")
                empty_png = os.path.join(temp_dir, "empty.png")
                
                # Generate a 1x1 transparent PNG for gaps
                from playwright.sync_api import sync_playwright
                with sync_playwright() as p:
                    b = p.chromium.launch(headless=True)
                    pg = b.new_page(viewport={'width': width, 'height': height})
                    pg.evaluate("document.body.style.background = 'transparent'")
                    pg.screenshot(path=empty_png, omit_background=True)
                    b.close()
                    
                last_end = 0.0
                
                with open(concat_file, "w") as f:
                    for img in image_map:
                        start = img['start']
                        end = img['end']
                        
                        # Gap before this subtitle
                        gap = start - last_end
                        if gap > 0.05: # Threshold to avoid tiny 1-frame gaps flickering
                            f.write(f"file 'empty.png'\n")
                            f.write(f"duration {gap}\n")
                        
                        # The subtitle itself
                        duration = end - start
                        safe_path = os.path.basename(img['path'])
                        f.write(f"file '{safe_path}'\n")
                        f.write(f"duration {duration}\n")
                        
                        # Update last_end to actual end of this clip
                        # Note: Concat adds durations cumulatively.
                        last_end = end
                    
                    # Pad end of video? 
                    # If the video is longer than subtitles, overlay will just stop. That's fine.
                    # Or we can add a final empty frame.
                    f.write(f"file 'empty.png'\n")
                    f.write(f"duration 10.0\n") # Arbitrary pad
                
                # Generate Subtitle Layer Video (MOV with Alpha)
                sub_layer_mov = "subs.mov" # Relative to temp_dir
                
                # Command to generate MOV from images
                sub_gen_cmd = [
                    'ffmpeg', '-f', 'concat', '-safe', '0', '-i', 'inputs.txt',
                    '-c:v', 'qtrle', # Lossless Animation Codec (supports alpha)
                    sub_layer_mov, '-y'
                ]
                
                print(f"Rendering subtitle layer video...")
                subprocess.run(sub_gen_cmd, cwd=temp_dir, check=True)
                
                sub_layer_abs = os.path.join(temp_dir, sub_layer_mov)
                
                # Overlay onto Main Video
                print("Overlaying subtitle layer onto video...")
                
                # We restart stream definition for overlay
                # Note: We must re-encode (cannot -c copy)
                input_video = ffmpeg.input(video_path)
                input_subs = ffmpeg.input(sub_layer_abs)
                
                # Overlay with shortest=1 to stop if one stream ends (usually video)
                # But we padded subs, so video length should dictate.
                stream = ffmpeg.overlay(input_video, input_subs, eof_action='pass')
                
                # Preserve Audio
                audio = ffmpeg.input(video_path).audio
                
                stream = ffmpeg.output(stream, audio, output_path, **{'c:v': 'libx264', 'preset': 'fast', 'c:a': 'aac'}) 
                ffmpeg.run(stream, overwrite_output=True)
                
                print("Image Burn Successful!")
                # Cleanup
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass
                return True
                
        except Exception as e:
            print(f"IMAGE BURN FAILED: {e}")
            import traceback
            traceback.print_exc()
            print("Falling back to ASS/SRT burning...")
            # Fallthrough to next strategy
    
    # --- STRATEGY 2: ASS BURN (Fallback) ---
    ass_path = None
    burn_source = None
    burn_filter = None
    
    if style_config and segments:
        # Generate ASS file
        ass_filename = f"temp_{os.path.basename(video_path)}_{style_config.get('fontFamily', 'font')}.ass"
        ass_path = os.path.join(os.getcwd(), ass_filename) 
        generate_ass_file(segments, style_config, ass_path, width, height)
        burn_source = ass_path
        burn_filter = f"ass='{os.path.basename(ass_path)}'"
    else:
        # --- STRATEGY 3: SRT BURN (Legacy) ---
        burn_source = subtitle_path
        temp_srt_name = "temp_burn_root.srt"
        temp_srt_path = os.path.join(os.getcwd(), temp_srt_name)
        import shutil
        shutil.copy2(subtitle_path, temp_srt_path)
        burn_source = temp_srt_path
        burn_filter = f"subtitles='{os.path.basename(temp_srt_path)}'"
        
        if style_config:
            font_size = style_config.get('fontSize', 24)
            primary_color = hex_to_ass_color(style_config.get('color', '#ffffff'))
            back_color = hex_to_ass_color(style_config.get('backgroundColor', '#000000'), style_config.get('backgroundOpacity', 0.6))
            margin_v = 50 
            force_style = f"FontSize={font_size},PrimaryColour={primary_color},BackColour={back_color},BorderStyle=3,Outline=0,Shadow=0,Alignment=2,MarginV={margin_v}"
            burn_filter += f":force_style='{force_style}'"

    # DEBUG LOGGING
    with open("burn_debug.log", "a", encoding="utf-8") as log:
        log.write(f"\n--- New Burn Request (Fallback Mode) ---\n")
        log.write(f"Source: {burn_source}\n")
        log.write(f"Filter: {burn_filter}\n")

    try:
        stream = ffmpeg.input(video_path)
        stream = ffmpeg.output(stream, output_path, vf=burn_filter)
        
        try:
             cmd = ffmpeg.compile(stream, overwrite_output=True)
             with open("burn_debug.log", "a", encoding="utf-8") as log:
                 log.write(f"FFmpeg Command: {cmd}\n")
        except:
             pass

        ffmpeg.run(stream, overwrite_output=True, capture_stderr=True)
        return True
            
    except ffmpeg.Error as e:
        err_msg = e.stderr.decode('utf8') if e.stderr else str(e)
        print(f"FFmpeg error: {err_msg}")
        with open("burn_debug.log", "a", encoding="utf-8") as log:
            log.write(f"FFmpeg FAILURE (Stderr):\n{err_msg}\n")
        return False
        
    except Exception as e:
        print(f"General Error: {e}")
        with open("burn_debug.log", "a", encoding="utf-8") as log:
            log.write(f"General Failure: {e}\n")
        return False
        
    finally:
        # Cleanup
        try:
            if ass_path and os.path.exists(ass_path):
                # print(f"DEBUG: Kept ASS file at {ass_path}") 
                os.remove(ass_path) # Auto cleanup unless debug requested
            if 'temp_srt_path' in locals() and os.path.exists(temp_srt_path):
                os.remove(temp_srt_path)
        except Exception as e:
            print(f"Cleanup error: {e}")

def embed_soft_subtitles(video_path, subtitle_path, output_path):
    """
    Embeds subtitles as a soft track (MKV or MP4) without re-encoding video/audio.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    if not os.path.exists(subtitle_path):
        raise FileNotFoundError(f"Subtitle file not found: {subtitle_path}")

    try:
        # Use simple map to copy streams and add subtitle stream
        # -c copy copies video/audio (fast)
        # -c:s srt sets subtitle codec
        input_video = ffmpeg.input(video_path)
        input_subs = ffmpeg.input(subtitle_path)
        
        stream = ffmpeg.output(
            input_video, 
            input_subs, 
            output_path, 
            c='copy', 
            **{'c:s': 'srt', 'metadata:s:s:0': 'language=eng'}
        )
        
        ffmpeg.run(stream, overwrite_output=True)
        return True
    except ffmpeg.Error as e:
        print(f"FFmpeg error: {e.stderr.decode('utf8') if e.stderr else str(e)}")
        return False
