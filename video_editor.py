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

def burn_subtitles(video_path, subtitle_path, output_path):
    """
    Burns subtitles into the video using FFmpeg.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    if not os.path.exists(subtitle_path):
        raise FileNotFoundError(f"Subtitle file not found: {subtitle_path}")

    try:
        # Note: 'vf' filter for subtitles needs the path to be properly escaped or relative if possible.
        # Ideally, use forward slashes for paths in ffmpeg filter
        subtitle_path_fwd = subtitle_path.replace('\\', '/').replace(':', '\\:')
        
        stream = ffmpeg.input(video_path)
        stream = ffmpeg.output(stream, output_path, vf=f"subtitles='{subtitle_path_fwd}'")
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
