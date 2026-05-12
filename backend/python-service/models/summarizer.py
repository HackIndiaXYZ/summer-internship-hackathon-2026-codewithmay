from transformers import pipeline
import torch

class Summarizer:
    def __init__(self):
        self.summarizer = None
        self.load_model()
    
    def load_model(self):
        try:
            print("   Loading summarization model...")
            print("   • google/pegasus-xsum...")
            
            self.summarizer = pipeline(
                "summarization",
                model="google/pegasus-xsum",
                device=0 if torch.cuda.is_available() else -1
            )
            
            print("     ✅ Loaded")
            
        except Exception as e:
            print(f"     ⚠️  Failed to load summarizer: {e}")
            self.summarizer = None
    
    def summarize(self, text, max_length=150, min_length=50):
        if not self.summarizer:
            return "Summarization model not available."
        
        try:
            text_truncated = text[:3000]
            summary = self.summarizer(
                text_truncated,
                max_length=max_length,
                min_length=min_length,
                do_sample=False
            )
            return summary[0]['summary_text']
        except Exception as e:
            print(f"   ❌ Summarization error: {e}")
            return f"Error: {str(e)}"
    
    def is_loaded(self):
        return self.summarizer is not None
