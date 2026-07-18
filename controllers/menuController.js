import MenuItem from "../models/MenuItem.js";
import cloudinary from "../utils/cloudinary.js";

// ✅ Helper: Upload image to Cloudinary with better error handling
const uploadToCloudinary = async (imageBase64) => {
  try {
    console.log('📤 Uploading to Cloudinary...');
    console.log('📊 Image size:', Math.round(imageBase64.length / 1024), 'KB');
    
    // ✅ Ensure proper base64 format
    let imageData = imageBase64;
    if (!imageData.startsWith('data:image')) {
      imageData = `data:image/jpeg;base64,${imageData}`;
    }

    const result = await cloudinary.uploader.upload(imageData, {
      folder: 'spice-corner/menu',
      transformation: [
        { width: 500, height: 400, crop: 'fill' },
        { quality: 'auto' }
      ]
    });
    
    console.log('✅ Upload successful:', result.secure_url);
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
    
  } catch (error) {
    console.error('❌ Cloudinary upload error:');
    console.error('📊 Status:', error.http_code || 'N/A');
    console.error('📊 Message:', error.message);
    
    // ✅ Provide more specific error messages
    if (error.http_code === 403) {
      throw new Error('❌ Cloudinary authentication failed. Please check your API credentials in .env file.');
    } else if (error.http_code === 400) {
      throw new Error('❌ Invalid image format. Please use JPG or PNG.');
    } else if (error.http_code === 413) {
      throw new Error('❌ Image too large. Maximum size is 5MB.');
    } else {
      throw new Error(`❌ Upload failed: ${error.message}`);
    }
  }
};

// ✅ Public: Get all menu items
export const getMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.find().sort({ category: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Admin: Create menu item with image
export const createMenuItem = async (req, res) => {
  try {
    const { name, description, price, category, available, image } = req.body;

    console.log('📝 Creating menu item:', name);
    console.log('🖼️ Image provided:', image ? '✅ Yes' : '❌ No');

    let imageUrl = '';
    let imagePublicId = '';

    // ✅ If image is provided, upload to Cloudinary
    if (image && image.startsWith('data:image')) {
      try {
        const result = await uploadToCloudinary(image);
        imageUrl = result.url;
        imagePublicId = result.publicId;
      } catch (uploadError) {
        console.error('❌ Upload error:', uploadError.message);
        return res.status(400).json({ 
          message: uploadError.message,
          error: 'CLOUDINARY_UPLOAD_FAILED'
        });
      }
    } else {
      console.log('ℹ️ No image provided, using default');
    }

    const item = await MenuItem.create({
      name,
      description,
      price,
      category,
      available: available !== undefined ? available : true,
      image: imageUrl,
      imagePublicId: imagePublicId,
    });

    console.log('✅ Menu item created:', item._id);
    res.status(201).json(item);

  } catch (err) {
    console.error('❌ Create menu error:', err);
    res.status(400).json({ 
      message: "Could not create menu item", 
      error: err.message 
    });
  }
};

// ✅ Admin: Update menu item with image
export const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, available, image } = req.body;

    const existingItem = await MenuItem.findById(id);
    if (!existingItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    console.log('📝 Updating menu item:', name);
    console.log('🖼️ New image provided:', image && image.startsWith('data:image') ? '✅ Yes' : '❌ No');

    let imageUrl = existingItem.image || '';
    let imagePublicId = existingItem.imagePublicId || '';

    // ✅ If new image is provided, upload and delete old one
    if (image && image.startsWith('data:image')) {
      // Delete old image from Cloudinary
      if (existingItem.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existingItem.imagePublicId);
          console.log('🗑️ Old image deleted:', existingItem.imagePublicId);
        } catch (deleteError) {
          console.error('⚠️ Could not delete old image:', deleteError);
        }
      }

      // Upload new image
      try {
        const result = await uploadToCloudinary(image);
        imageUrl = result.url;
        imagePublicId = result.publicId;
      } catch (uploadError) {
        console.error('❌ Upload error:', uploadError.message);
        return res.status(400).json({ 
          message: uploadError.message,
          error: 'CLOUDINARY_UPLOAD_FAILED'
        });
      }
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      {
        name,
        description,
        price,
        category,
        available: available !== undefined ? available : existingItem.available,
        image: imageUrl,
        imagePublicId: imagePublicId,
      },
      { new: true, runValidators: true }
    );

    console.log('✅ Menu item updated:', updatedItem._id);
    res.json(updatedItem);

  } catch (err) {
    console.error('❌ Update menu error:', err);
    res.status(400).json({ 
      message: "Could not update menu item", 
      error: err.message 
    });
  }
};

// ✅ Admin: Delete menu item with image
export const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await MenuItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Delete image from Cloudinary
    if (item.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(item.imagePublicId);
        console.log('🗑️ Image deleted from Cloudinary:', item.imagePublicId);
      } catch (deleteError) {
        console.error('⚠️ Could not delete image:', deleteError);
      }
    }

    await MenuItem.findByIdAndDelete(id);
    console.log('✅ Menu item deleted:', id);
    res.json({ message: "Menu item deleted" });

  } catch (err) {
    console.error('❌ Delete menu error:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};