import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Debug: Log credentials (masked for security)
console.log('☁️ Cloudinary Config:');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || '❌ Not Set');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Not Set');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Not Set');

// Configure Cloudinary - ✅ FIXED CONFIG
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ✅ Test connection with better error handling
const testCloudinary = async () => {
  try {
    console.log('🔄 Testing Cloudinary connection...');
    const result = await cloudinary.v2.api.ping();
    console.log('✅ Cloudinary connection successful!');
    console.log('📊 Status:', result.status);
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:');
    console.error('📊 Status:', error.http_code || 'N/A');
    console.error('📊 Message:', error.message);
    console.error('📊 Full error:', error);
    
    // ✅ Check if it's a 403 error
    if (error.http_code === 403) {
      console.error('🔑 Possible issues:');
      console.error('  1. API key or secret is incorrect');
      console.error('  2. Cloud name is incorrect');
      console.error('  3. Account is not activated');
      console.error('  4. Using wrong environment (test vs production)');
    }
    return false;
  }
};

// Run test
testCloudinary();

export default cloudinary.v2;