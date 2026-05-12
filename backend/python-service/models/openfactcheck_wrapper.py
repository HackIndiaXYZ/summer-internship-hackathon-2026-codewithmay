class OpenFactCheckWrapper:
    def __init__(self):
        self.loaded = False
        self.checker = None
        self.load_checker()
    
    def load_checker(self):
        try:
            print("   Loading OpenFactCheck...")
            print("     ⚠️  OpenFactCheck not configured (optional)")
        except Exception as e:
            print(f"     ⚠️  OpenFactCheck not available: {e}")
            self.loaded = False
    
    def check(self, claim):
        return None
    
    def is_loaded(self):
        return self.loaded
