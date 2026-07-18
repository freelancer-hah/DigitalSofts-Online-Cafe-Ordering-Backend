import axios from 'axios';
import MenuItem from '../models/MenuItem.js';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Google Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;// Universal Recognition with Gemini
export const recognizeFood = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ message: 'Image is required' });
    }

    console.log('📸 Recognizing food from image using Gemini...');

    // Get ALL menu items from database
    const menuItems = await MenuItem.find({ available: true });
    
    if (menuItems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No menu items found. Please add items first.' 
      });
    }

    console.log(`📋 Menu has ${menuItems.length} items`);

    let imageDescription = '';
    let predictions = [];

    // ✅ Try Gemini API if key exists
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here' && GEMINI_API_KEY.length > 10) {
      try {
        imageDescription = await getImageDescription(imageBase64);
        console.log('📝 Gemini Description:', imageDescription);
        
        // Also get labels using Gemini
        predictions = await getImageLabels(imageBase64);
        console.log('🏷️ Gemini Labels:', predictions.slice(0, 5));
      } catch (geminiError) {
        console.log('⚠️ Gemini API error:', geminiError.message);
        console.log('🔄 Using fallback detection...');
      }
    } else {
      console.log('⚠️ No valid Gemini API key found.');
    }

    // ✅ If API returned a description, use it to find best match
    if (imageDescription) {
      const matchedItem = findBestMatchFromDescription(imageDescription, menuItems);
      
      if (matchedItem && matchedItem.confidence > 50) {
        return res.json({
          success: true,
          message: `✅ Detected: ${matchedItem.name}`,
          item: matchedItem,
          confidence: matchedItem.confidence,
          description: imageDescription,
          model: 'Gemini-2.0-Flash-Lite'
        });
      }
    }

    // ✅ If no match from API, try fallback matching
    const matchedItem = findBestMatchUniversal(imageDescription, predictions, menuItems);
    
    if (matchedItem && matchedItem.confidence > 40) {
      return res.json({
        success: true,
        message: `✅ Detected: ${matchedItem.name}`,
        item: matchedItem,
        confidence: matchedItem.confidence,
        description: imageDescription || 'Food image detected',
        model: 'fallback'
      });
    } else {
      const suggestions = menuItems.slice(0, 8).map(i => i.name);
      return res.json({
        success: false,
        message: '❌ Could not identify. Please select from suggestions:',
        suggestions: suggestions,
        description: imageDescription || 'No description available',
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Vision recognition error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get image description using Gemini
const getImageDescription = async (imageBase64) => {
  try {
    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    console.log('📤 Sending to Gemini...');
    console.log('📊 Image size:', base64Data.length, 'chars');

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: 'Identify the food dish in this image. Reply with ONLY the dish name (2-4 words), nothing else. If it looks like a South Asian/Pakistani dish, name it specifically (e.g. Gulab Jamun, Chicken Biryani, Seekh Kebab, Nihari, Gol Gappa). If multiple dishes are visible, name the main one.'
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 20
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      }
    );

    console.log('📥 Gemini Response status:', response.status);

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('📝 Model response:', text);
    
    return text.trim();
  } catch (error) {
    console.error('❌ Gemini error:');
    console.error('📊 Status:', error.response?.status);
    console.error('📊 Data:', error.response?.data);
    console.error('📊 Message:', error.message);
    return '';
  }
};

// ✅ Get image labels using Gemini (alternative prompt)
const getImageLabels = async (imageBase64) => {
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: 'List 3-5 food items or ingredients you can see in this image. Reply with ONLY a comma-separated list, nothing else. Example: chicken, rice, spices, curry, bread'
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 30
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const labels = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    return labels.map(label => ({
      label: label,
      score: 0.7
    }));
  } catch (error) {
    console.error('❌ Gemini labels error:', error.message);
    return [];
  }
};

// ✅ Find best match from description
const findBestMatchFromDescription = (description, menuItems) => {
  if (!description) return null;
  
  let bestMatch = null;
  let bestScore = 0;
  const descLower = description.toLowerCase();

  menuItems.forEach(item => {
    const itemName = item.name.toLowerCase();
    let score = 0;

    // Direct match
    if (descLower.includes(itemName)) {
      score += 0.8;
    }

    // Word match
    const itemWords = itemName.split(' ');
    itemWords.forEach(word => {
      if (word.length > 2 && descLower.includes(word)) {
        score += 0.2;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        ...item.toObject(),
        confidence: Math.min(Math.round(score * 100), 90)
      };
    }
  });

  return bestMatch;
};

// ✅ Universal matching - Works with ANY menu item (Fallback)
const findBestMatchUniversal = (description, predictions, menuItems) => {
  let bestMatch = null;
  let bestScore = 0;

  // Combine all text for matching
  const allText = [
    description.toLowerCase(),
    ...predictions.map(p => p.label.toLowerCase())
  ].join(' ');

  console.log('📝 Text to match (fallback):', allText);

  // Score each menu item
  menuItems.forEach(item => {
    const itemName = item.name.toLowerCase();
    const itemWords = itemName.split(' ');
    let score = 0;

    // Method 1: Direct name match
    if (allText.includes(itemName)) {
      score += 0.6;
    }

    // Method 2: Word-by-word match
    itemWords.forEach(word => {
      if (word.length > 2 && allText.includes(word)) {
        score += 0.2;
      }
    });

    // Method 3: Partial word match
    itemWords.forEach(word => {
      if (word.length > 3) {
        const wordParts = word.slice(0, -1);
        if (allText.includes(wordParts)) {
          score += 0.15;
        }
      }
    });

    // Method 4: Category match
    if (item.category) {
      const category = item.category.toLowerCase();
      if (allText.includes(category)) {
        score += 0.15;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        ...item.toObject(),
        confidence: Math.min(Math.round(score * 100), 90)
      };
    }
  });

  // If no match, use first item with low confidence
  if (!bestMatch && menuItems.length > 0) {
    bestMatch = {
      ...menuItems[0].toObject(),
      confidence: 30,
      note: 'No clear match found - suggesting popular item'
    };
  }
console.log('🎯 Best match:', bestMatch?.name, '| Score:', bestScore);
  return bestMatch;
};

// ✅ Simple recognition (Alternative)
export const recognizeFoodSimple = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ message: 'Image is required' });
    }

    console.log('📸 Simple recognition...');

    const menuItems = await MenuItem.find({ available: true });
    
    if (menuItems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No menu items found.' 
      });
    }

    // Try Gemini
    let description = '';
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        description = await getImageDescription(imageBase64);
        console.log('📝 Description:', description);
      } catch (e) {
        console.log('⚠️ Could not get description');
      }
    }

    // If no description, return suggestions
    if (!description) {
      return res.json({
        success: false,
        message: '📸 Please select from our menu:',
        suggestions: menuItems.map(i => i.name).slice(0, 8),
        description: 'No AI description available'
      });
    }

    // Find best match
    const matchedItem = findBestMatchFromDescription(description, menuItems);
    
    if (matchedItem && matchedItem.confidence > 50) {
      return res.json({
        success: true,
        message: `✅ Detected: ${matchedItem.name}`,
        item: matchedItem,
        confidence: matchedItem.confidence,
        description: description
      });
    } else {
      return res.json({
        success: false,
        message: '❌ Could not identify. Please select from suggestions:',
        suggestions: menuItems.map(i => i.name).slice(0, 8),
        description: description
      });
    }

  } catch (error) {
    console.error('❌ Simple recognition error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Test connection
export const testConnection = async (req, res) => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return res.json({ 
        success: false, 
        message: 'Gemini API key is not set' 
      });
    }

    // Test with a simple prompt
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              { text: 'Say "Hello from Gemini!"' }
            ]
          }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    res.json({ 
      success: true, 
      message: 'Gemini API is working!',
      response: text
    });
  } catch (error) {
    console.error('❌ Test error:', error.message);
    res.json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || 'Unknown error'
    });
  }
};