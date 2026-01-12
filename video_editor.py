import ffmpeg
import os

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

def burn_subtitles(video_path, subtitle_path, output_path, style_config=None):
    """
    Burns subtitles into the video using FFmpeg with optional styling.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    if not os.path.exists(subtitle_path):
        raise FileNotFoundError(f"Subtitle file not found: {subtitle_path}")

    force_style = ""
    if style_config:
        # Defaults
        font_name = "Arial" # Fallback safe font
        font_size = style_config.get('fontSize', 24)
        # Scale font size? React px vs FFmpeg px. Usually close enough for 1080p.
        # Maybe scale based on video height? For now use raw.
        
        primary_color = hex_to_ass_color(style_config.get('color', '#ffffff'))
        
        # Background: ASS Outline/Shadow usage. 
        # To get a box, we use BorderStyle=3 (Opaque box)
        back_color = hex_to_ass_color(style_config.get('backgroundColor', '#000000'), style_config.get('backgroundOpacity', 0.6))
        
        # Alignment
        # yAlign is % from TOP. ASS uses MarginV from BOTTOM for Alignment=2.
        # We need video height to calculate pixel margin if using percent.
        # Simpler: Just map high yAlign (85) to low MarginV.
        # But yAlign is 0-100.
        # Let's try to get video height.
        video_info = get_video_info(video_path)
        video_height = int(video_info['height']) if video_info else 1080
        
        y_align_percent = style_config.get('yAlign', 85)
        margin_v = int(video_height * (1 - y_align_percent / 100))
        
        force_style = (
            f"FontName={font_name},FontSize={font_size},"
            f"PrimaryColour={primary_color},BackColour={back_color},"
            f"BorderStyle=3,Outline=0,Shadow=0," # BorderStyle=3 is box
            f"Alignment=2,MarginV={margin_v}" # Bottom Center
        )

    try:
        # Note: 'vf' filter for subtitles needs the path to be properly escaped or relative if possible.
        # Ideally, use forward slashes for paths in ffmpeg filter
        subtitle_path_fwd = subtitle_path.replace('\\', '/').replace(':', '\\:')
        
        stream = ffmpeg.input(video_path)
        
        subtitles_filter = f"subtitles='{subtitle_path_fwd}'"
        if force_style:
            subtitles_filter += f":force_style='{force_style}'"
            
        stream = ffmpeg.output(stream, output_path, vf=subtitles_filter)
        ffmpeg.run(stream, overwrite_output=True)
        return True
    except ffmpeg.Error as e:
        print(f"FFmpeg error: {e.stderr.decode('utf8') if e.stderr else str(e)}")
        return False

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
