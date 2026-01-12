import whisper
import os

def transcribe_video(video_path, model_size="base"):
    """
    Transcribes a video file using OpenAI Whisper.
    
    Args:
        video_path (str): Path to the video file.
        model_size (str): Size of the Whisper model to use (tiny, base, small, medium, large).
        
    Returns:
        dict: Transcription result containing segments with start, end, and text.
    """
    # Check if file exists
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    print(f"Loading Whisper model: {model_size}...")
    model = whisper.load_model(model_size)
    
    print(f"Transcribing {video_path}...")
    # Use initial_prompt to guide the model to use Latin script for Hindi (Hinglish)
    # and maintain English for English parts.
    prompt = "The following is a transcript in English and Hinglish. Hindi words are spelled efficiently in English script. Namaste, aap kaise hain? Main thik hoon. I am doing good."
    result = model.transcribe(video_path, initial_prompt=prompt, word_timestamps=True)
    
    return {
        'segments': result['segments'],
        'language': result['language']
    }
