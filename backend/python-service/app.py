from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

# Import model modules
from models.fake_news import FakeNewsDetector
from models.nli_models import NLIModels
from models.summarizer import Summarizer
from models.openfactcheck_wrapper import OpenFactCheckWrapper

app = Flask(__name__)
CORS(app)

# Initialize models
print("🤖 Initializing ML models...")
fake_news_detector = FakeNewsDetector()
nli_models = NLIModels()
summarizer = Summarizer()
openfactcheck = OpenFactCheckWrapper()
print("✅ Models loaded successfully\n")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'models_loaded': {
            'fake_news': fake_news_detector.is_loaded(),
            'nli': nli_models.is_loaded(),
            'summarizer': summarizer.is_loaded(),
            'openfactcheck': openfactcheck.is_loaded()
        }
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        claim = data.get('claim', '')
        
        if not claim:
            return jsonify({'error': 'Claim is required'}), 400
        
        print(f"\n{'='*60}")
        print(f"🔬 ANALYZING CLAIM WITH ML MODELS")
        print(f"{'='*60}\n")
        print(f"Claim: {claim[:100]}...")
        
        results = []
        
        # 1. Fake News Detection Models
        print("\n📊 Running fake news detection...")
        fake_news_results = fake_news_detector.predict(claim)
        results.extend(fake_news_results)
        
        # 2. NLI Models
        print("\n🧠 Running NLI models...")
        nli_results = nli_models.predict(claim)
        results.extend(nli_results)
        
        # 3. OpenFactCheck
        print("\n🔍 Running OpenFactCheck...")
        ofc_results = openfactcheck.check(claim)
        if ofc_results:
            results.append(ofc_results)
        
        print(f"\n✅ ML Analysis complete: {len(results)} models\n")
        
        return jsonify({
            'success': True,
            'models': results,
            'total_models': len(results)
        })
        
    except Exception as e:
        print(f"❌ Error in analysis: {str(e)}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/summarize', methods=['POST'])
def summarize_text():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        print(f"📝 Summarizing text ({len(text)} chars)...")
        summary = summarizer.summarize(text)
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        print(f"❌ Error in summarization: {str(e)}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5001))
    print(f"\n🚀 Python ML Service starting on port {port}")
    print(f"{'='*60}\n")
    app.run(host='0.0.0.0', port=port, debug=False)