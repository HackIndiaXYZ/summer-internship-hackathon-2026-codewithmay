const Tesseract = require('tesseract.js');

class OCRService {
  async extractText(imagePath) {
    try {
      console.log('🔤 Starting OCR on:', imagePath);
      
      const { data: { text } } = await Tesseract.recognize(
        imagePath,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      console.log('✅ OCR complete');
      return text.trim();
    } catch (error) {
      console.error('❌ OCR Error:', error);
      throw new Error('Text extraction failed');
    }
  }
}

module.exports = new OCRService();