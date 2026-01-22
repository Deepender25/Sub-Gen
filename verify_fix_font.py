import os
import shutil
from video_editor import generate_subtitle_images

def verify_font_rendering():
    # Test Data
    subtitles = [
        {"start": 0.0, "end": 2.0, "text": "This should be in Bangers font!"},
        {"start": 2.0, "end": 4.0, "text": "And this line checks wrapping behavior properly."}
    ]
    
    style_config = {
        "fontFamily": "Bangers",
        "fontSize": 60,
        "color": "#ff0000", # Red
        "backgroundColor": "#000000",
        "backgroundOpacity": 0.8,
        "displayMode": "sentence",
        "wordsPerLine": 5 # promote wrapping
    }
    
    output_dir = "test_font_output"
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
        
    try:
        print("Generating images...")
        images = generate_subtitle_images(subtitles, style_config, output_dir, 1920, 1080)
        print(f"Generated {len(images)} images in {output_dir}")
        
        # Verify existence
        if len(images) == 2 and os.path.exists(os.path.join(output_dir, "sub_0000.png")):
            print("SUCCESS: Images generated.")
        else:
            print("FAILURE: Images not generated correctly.")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_font_rendering()
