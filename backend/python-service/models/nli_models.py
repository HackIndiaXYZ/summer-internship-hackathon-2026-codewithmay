from transformers import pipeline
import torch

class NLIModels:
    def __init__(self):
        self.models = []
        self.load_models()
    
    def load_models(self):
        try:
            print("   Loading NLI models...")
            
            try:
                print("   • facebook/bart-large-mnli...")
                model1 = pipeline(
                    "zero-shot-classification",
                    model="facebook/bart-large-mnli",
                    device=0 if torch.cuda.is_available() else -1
                )
                self.models.append({
                    'name': 'facebook/bart-large-mnli',
                    'pipeline': model1
                })
                print("     ✅ Loaded")
            except Exception as e:
                print(f"     ⚠️  Failed to load: {e}")
            
            try:
                print("   • valhalla/distilbart-mnli-12-9...")
                model2 = pipeline(
                    "zero-shot-classification",
                    model="valhalla/distilbart-mnli-12-9",
                    device=0 if torch.cuda.is_available() else -1
                )
                self.models.append({
                    'name': 'valhalla/distilbart-mnli-12-9',
                    'pipeline': model2
                })
                print("     ✅ Loaded")
            except Exception as e:
                print(f"     ⚠️  Failed to load: {e}")
            
            print(f"   ✅ Loaded {len(self.models)} NLI model(s)")
            
        except Exception as e:
            print(f"   ❌ Error loading NLI models: {e}")
    
    def predict(self, text):
        results = []
        candidate_labels = ["true", "false", "uncertain"]
        
        for model_info in self.models:
            try:
                text_truncated = text[:512]
                prediction = model_info['pipeline'](text_truncated, candidate_labels, multi_label=False)
                
                top_label = prediction['labels'][0]
                top_score = prediction['scores'][0]
                verdict = top_label.upper()
                confidence = int(top_score * 100)
                
                results.append({
                    'name': f"NLI Model: {model_info['name'].split('/')[-1]}",
                    'type': 'ml-nli',
                    'verdict': verdict,
                    'confidence': confidence,
                    'url': f"https://huggingface.co/{model_info['name']}",
                    'hasEvidence': True,
                    'excerpt': f"NLI prediction: {top_label} (confidence: {confidence}%)",
                    'fullText': f"NLI Model: {model_info['name']}\n\nInput: {text[:200]}...\n\nPrediction: {top_label}\nConfidence: {confidence}%",
                    'metadata': {
                        'model': model_info['name'],
                        'all_labels': prediction['labels'],
                        'all_scores': prediction['scores']
                    }
                })
                
                print(f"   • {model_info['name'].split('/')[-1]}: {verdict} ({confidence}%)")
                
            except Exception as e:
                print(f"   ❌ Error with {model_info['name']}: {e}")
        
        return results
    
    def is_loaded(self):
        return len(self.models) > 0