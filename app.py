import os
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename
import transcriber
import video_editor
import uuid

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'video' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Unique filename to avoid collisions
        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': unique_filename,
            'url': f"/uploads/{unique_filename}"
        })
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/process', methods=['POST'])
def process_video():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        # Use medium model for better quality and language detection
        result = transcriber.transcribe_video(filepath, model_size="medium")
        return jsonify({
            'segments': result['segments'],
            'language': result['language']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/burn', methods=['POST'])
def burn_video():
    data = request.json
    filename = data.get('filename')
    segments = data.get('segments')
    
    if not filename or not segments:
        return jsonify({'error': 'Filename and segments required'}), 400

    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    srt_filename = f"{os.path.splitext(filename)[0]}.srt"
    srt_path = os.path.join(app.config['OUTPUT_FOLDER'], srt_filename)
    
    # Generate SRT first
    video_editor.generate_srt(segments, srt_path)
    
    # Burn subtitles
    output_filename = f"subtitled_{filename}"
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
    
    success = video_editor.burn_subtitles(input_path, srt_path, output_path)
    
    if success:
        return jsonify({
            'message': 'Subtitles burned successfully',
            'download_url': f"/download/{output_filename}"
        })
    else:
        return jsonify({'error': 'Failed to burn subtitles'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
