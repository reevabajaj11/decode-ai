# app.py (UPDATED WITH URL SUPPORT)

from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
import json
import re
import fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- App Setup ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Configure the Gemini API ---
API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable not set.")
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('models/gemini-flash-latest')

# --- Helper Functions ---
def extract_and_parse_json(text):
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        json_string = match.group(0)
        try:
            return json.loads(json_string)
        except json.JSONDecodeError as e:
            print(f"JSON Decode Error: {e}")
            return None
    return None

def extract_text_from_file(file):
    filename = file.filename
    if filename.endswith('.pdf'):
        try:
            doc = fitz.open(stream=file.read(), filetype="pdf")
            text = "".join(page.get_text() for page in doc)
            doc.close()
            return text
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return None
    # Handle .txt or blob uploads (Paste Text often has no extension)
    return file.read().decode('utf-8', errors='ignore')

def extract_text_from_url(url):
    try:
        # User-Agent header makes us look like a real browser, not a bot
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', '').lower()
        
        # 1. Handle PDF URLs
        if 'application/pdf' in content_type or url.lower().endswith('.pdf'):
            with fitz.open(stream=response.content, filetype="pdf") as doc:
                text = "".join(page.get_text() for page in doc)
            return text
            
        # 2. Handle Standard Websites (HTML)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove junk elements (scripts, styles, navbars, footers)
        for script in soup(["script", "style", "nav", "footer", "header", "meta", "noscript"]):
            script.decompose()
            
        text = soup.get_text(separator='\n')
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return clean_text

    except Exception as e:
        print(f"Error fetching URL: {e}")
        return None

def get_gemini_analysis(document_content):
    """Shared function to call Gemini API"""
    system_prompt = """
    You are a legal document analysis bot. Analyze the provided document and return a single, valid JSON object.
    
    JSON Structure:
    {
      "summary": "<Comprehensive summary of the document>",
      "riskFlags": [
        { "level": "<'Red' or 'Yellow'>", "title": "<Risk Title>", "explanation": "<Risk Explanation>" }
      ],
      "keyClauses": [
        { "title": "<Clause Title>", "originalText": "<Original Clause Text>", "simplifiedText": "<Simplified Explanation>" }
      ]
    }
    """
    try:
        response = model.generate_content([system_prompt, f"Analyze this document:\n\n{document_content}"])
        analysis_dict = extract_and_parse_json(response.text)
        if analysis_dict:
            analysis_dict['fullDocumentText'] = document_content
            return analysis_dict
        return None
    except Exception as e:
        print(f"Error during Gemini API call: {e}")
        return None

# --- API Endpoint: File Upload ---
@app.route("/analyzeDocument", methods=['POST'])
def analyze_document():
    if 'document' not in request.files:
        return jsonify({"error": "No document part"}), 400
    file = request.files['document']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    document_content = extract_text_from_file(file)
    if not document_content:
        return jsonify({"error": "Could not extract text."}), 400

    result = get_gemini_analysis(document_content)
    if result:
        return jsonify(result)
    return jsonify({"error": "Analysis failed."}), 500

# --- API Endpoint: URL Analysis (NEW) ---
@app.route("/analyzeUrl", methods=['POST'])
def analyze_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "Missing URL"}), 400
    
    url = data['url']
    print(f"Processing URL: {url}") # Debug log
    
    document_content = extract_text_from_url(url)
    if not document_content:
        return jsonify({"error": "Could not fetch text from URL. It might be blocked or invalid."}), 400
        
    result = get_gemini_analysis(document_content)
    if result:
        return jsonify(result)
    return jsonify({"error": "Analysis failed."}), 500

# --- API Endpoint: Q&A ---
@app.route("/askQuestion", methods=['POST'])
def ask_question():
    data = request.get_json()
    if not data or 'question' not in data or 'context' not in data:
        return jsonify({"error": "Missing question or context"}), 400

    question = data['question']
    document_context = data['context']

    prompt = f"""
    Based ONLY on the document text provided below, answer the user's question in a simple and direct way. 
    If the answer is not in the document, say "I'm sorry, I cannot find the answer to that in this document."
    ---
    DOCUMENT TEXT: {document_context}
    ---
    USER'S QUESTION: "{question}"
    """
    try:
        response = model.generate_content(prompt)
        return jsonify({"answer": response.text})
    except Exception as e:
        print(f"Error during Q&A API call: {e}")
        return jsonify({"error": "Failed to get an answer."}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)