import Cart from '../models/Cart.js';
import { sendAbandonedCartEmail } from './email.js';
import { markAbandoned, updateRecoveryAttempt } from '../controllers/cartController.js';

// ✅ Check and process abandoned carts
export const processAbandonedCarts = async () => {
  try {
    console.log('🔄 Checking for abandoned carts...');
    
    // ✅ CHANGE: 12 minutes
    const twelveMinutesAgo = new Date(Date.now() - 12 * 60 * 1000);
    
    // Find carts that haven't been updated in 12+ minutes
    const carts = await Cart.find({
      status: 'active',
      updatedAt: { $lt: twelveMinutesAgo },
      customerEmail: { $ne: '' }
    }).populate('userId');

    console.log(`📋 Found ${carts.length} abandoned carts`);

    for (const cart of carts) {
      // Mark as abandoned
      await markAbandoned(cart._id);
      
      // Send recovery email
      await sendAbandonedCartEmail(cart);
      await updateRecoveryAttempt(cart._id);
      
      console.log(`📧 Recovery email sent to ${cart.customerEmail}`);
      
      // Wait 1 second between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Abandoned cart processing complete');
    return { processed: carts.length };
  } catch (error) {
    console.error('❌ Process abandoned carts error:', error);
    return { error: error.message };
  }
};

// ✅ Setup cron job (runs every 2 minutes)
export const startCartRecoveryScheduler = () => {
  console.log('⏰ Starting cart recovery scheduler (runs every 2 minutes)');
  console.log('⏱️ Abandoned after: 12 minutes');
  
  // Run immediately on startup
  setTimeout(() => processAbandonedCarts(), 5000);
  
  // Then every 2 minutes
  setInterval(processAbandonedCarts, 2 * 60 * 1000);
};