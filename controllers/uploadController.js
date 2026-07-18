import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload image and return base64
export const uploadImage = async (req, res) => {
  try {
    console.log('📸 Uploading image...');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    console.log('📁 File received:', req.file.filename);
    console.log('📁 File size:', req.file.size);

    // Convert image to base64
    const imagePath = path.join(__dirname, '../uploads', req.file.filename);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // Delete file after reading to save space
    try {
      fs.unlinkSync(imagePath);
      console.log('🗑️ Temporary file deleted');
    } catch (unlinkError) {
      console.log('⚠️ Could not delete temp file:', unlinkError.message);
    }

    res.json({
      success: true,
      imageBase64: imageBase64,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};