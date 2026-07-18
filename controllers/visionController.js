import axios from 'axios';
import MenuItem from '../models/MenuItem.js';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Google Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

// ✅ MAIN: Universal Recognition with Gemini - Direct Menu Matching
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

    // ✅ Prepare menu names list for Gemini
    const menuNames = menuItems.map(i => i.name);

    // ✅ Clean base64 data
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // ✅ PROMPT: Tell Gemini to match EXACTLY from menu
    const prompt = `You are matching a food photo to an exact item from a restaurant menu.

Menu items (choose EXACTLY one of these, character-for-character, or say NONE):
${menuNames.map(n => `- ${n}`).join('\n')}

Look at the image and reply with ONLY the exact matching menu item name from the list above. If nothing in the list matches the image, reply with exactly: NONE`;

    console.log('📤 Sending to Gemini with menu matching...');

    // ✅ Call Gemini API
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{
          parts: [
            { text: prompt },
            { 
              inline_data: { 
                mime_type: 'image/jpeg', 
                data: base64Data 
              } 
            }
          ]
        }],
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

    const rawAnswer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    console.log('🎯 Gemini picked:', rawAnswer);

    // ✅ Exact match against menu (case-insensitive, trimmed)
    const matched = menuItems.find(
      i => i.name.trim().toLowerCase() === rawAnswer.trim().toLowerCase()
    );

    if (matched) {
      return res.json({
        success: true,
        message: `✅ Detected: ${matched.name}`,
        item: matched,
        confidence: 90,
        model: 'Gemini-1.5-Flash',
        description: rawAnswer
      });
    } else {
      // ✅ If Gemini said "NONE" or didn't match, return suggestions
      const suggestions = menuNames.slice(0, 8);
      return res.json({
        success: false,
        message: '❌ Could not identify this food item.',
        suggestions: suggestions,
        description: rawAnswer === 'NONE' ? 'No matching dish found' : rawAnswer,
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Vision recognition error:', error.response?.data || error.message);
    
    // ✅ If Gemini fails, use fallback matching
    console.log('🔄 Using fallback matching...');
    try {
      const { imageBase64 } = req.body;
      const menuItems = await MenuItem.find({ available: true });
      
      if (menuItems.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'No menu items found.' 
        });
      }

      // ✅ Try to get description from Gemini as fallback
      let description = '';
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const descResponse = await axios.post(
          GEMINI_API_URL,
          {
            contents: [{
              parts: [
                { text: 'Describe what food you see in this image in 2-3 words.' },
                { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
              ]
            }]
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        description = descResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        console.log('📝 Fallback description:', description);
      } catch (descError) {
        console.log('⚠️ Could not get fallback description');
      }

      // ✅ Find best match from description
      const matchedItem = findBestMatchFromDescription(description, menuItems);
      
      if (matchedItem && matchedItem.confidence > 50) {
        return res.json({
          success: true,
          message: `✅ Detected: ${matchedItem.name}`,
          item: matchedItem,
          confidence: matchedItem.confidence,
          description: description || 'Food image detected',
          model: 'fallback'
        });
      } else {
        const suggestions = menuItems.slice(0, 8).map(i => i.name);
        return res.json({
          success: false,
          message: '❌ Could not identify. Please select from suggestions:',
          suggestions: suggestions,
          description: description || 'No description available',
          fallback: true
        });
      }
    } catch (fallbackError) {
      console.error('❌ Fallback error:', fallbackError.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Error processing image. Please try again.' 
      });
    }
  }
};

// ✅ Get image description using Gemini (Fallback)
const getImageDescription = async (imageBase64) => {
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    console.log('📤 Sending to Gemini for description...');

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: 'Identify the food dish in this image. Reply with ONLY the dish name (2-4 words), nothing else.'
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

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('📝 Model response:', text);
    
    return text.trim();
  } catch (error) {
    console.error('❌ Gemini description error:', error.response?.data || error.message);
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
  console.log('🎯 Best match (fallback):', bestMatch?.name, '| Score:', bestScore);
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

    // Try Gemini for description
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