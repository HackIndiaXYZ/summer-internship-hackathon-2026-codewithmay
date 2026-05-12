from transformers import pipeline
import torch

class FakeNewsDetector:
    def __init__(self):
        self.models = []
        self.load_models()
    
    def load_models(self):
        try:
            print("   Loading fake news detection models...")
            
            try:
                print("   • surferbaker/fake_news_detection...")
                model1 = pipeline(
                    "text-classification",
                    model="surferbaker/fake_news_detection",
                    device=0 if torch.cuda.is_available() else -1
                )
                self.models.append({
                    'name': 'surferbaker/fake_news_detection',
                    'pipeline': model1
                })
                print("     ✅ Loaded")
            except Exception as e:
                print(f"     ⚠️  Failed to load: {e}")
            
            try:
                print("   • microsoft/deberta-v3-small-fc-climate-fake-news...")
                model2 = pipeline(
                    "text-classification",
                    model="microsoft/deberta-v3-small-fc-climate-fake-news",
                    device=0 if torch.cuda.is_available() else -1
                )
                self.models.append({
                    'name': 'microsoft/deberta-v3-small-fc-climate-fake-news',
                    'pipeline': model2
                })
                print("     ✅ Loaded")
            except Exception as e:
                print(f"     ⚠️  Failed to load: {e}")
            
            print(f"   ✅ Loaded {len(self.models)} fake news model(s)")
            
        except Exception as e:
            print(f"   ❌ Error loading fake news models: {e}")
    
    def predict(self, text):
        results = []
        
        for model_info in self.models:
            try:
                text_truncated = text[:512]
                prediction = model_info['pipeline'](text_truncated)[0]
                
                label = prediction['label']
                score = prediction['score']
                verdict = self.map_label_to_verdict(label)
                confidence = int(score * 100)
                
                results.append({
                    'name': f"ML Model: {model_info['name'].split('/')[-1]}",
                    'type': 'ml-fake-news',
                    'verdict': verdict,
                    'confidence': confidence,
                    'url': f"https://huggingface.co/{model_info['name']}",
                    'hasEvidence': True,
                    'excerpt': f"Model prediction: {label} (confidence: {confidence}%)",
                    'fullText': f"Fake News Detection Model: {model_info['name']}\n\nInput: {text[:200]}...\n\nPrediction: {label}\nConfidence: {confidence}%\nVerdict: {verdict}",
                    'metadata': {
                        'model': model_info['name'],
                        'label': label,
                        'raw_score': score
                    }
                })
                
                print(f"   • {model_info['name'].split('/')[-1]}: {verdict} ({confidence}%)")
                
            except Exception as e:
                print(f"   ❌ Error with {model_info['name']}: {e}")
        
        return results
    
    def map_label_to_verdict(self, label):
        label_lower = label.lower()
        
        if 'true' in label_lower or 'real' in label_lower or 'reliable' in label_lower:
            return 'TRUE'
        elif 'fake' in label_lower or 'false' in label_lower or 'unreliable' in label_lower:
            return 'FALSE'
        else:
            return 'UNCERTAIN'
    
    def is_loaded(self):
        return len(self.models) > 0