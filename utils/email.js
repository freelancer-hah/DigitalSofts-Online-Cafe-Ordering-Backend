import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter with your credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'alltimefree4793@gmail.com',
    pass: process.env.EMAIL_PASS || 'ylei yfzt vkwb dbmc'
  },
  tls: {
    rejectUnauthorized: false
  },
  timeout: 30000,
  connectionTimeout: 30000,
});

// Send Order Confirmation Email
export const sendOrderConfirmation = async (order, customerEmail) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER && !process.env.EMAIL_PASS) {
      console.log('📧 Using hardcoded email credentials');
    }

    if (!customerEmail) {
      console.log('⚠️ No customer email provided, skipping email');
      return false;
    }

    console.log(`📧 Sending confirmation email to ${customerEmail}...`);

    // Generate order items HTML
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">Rs ${item.price}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">Rs ${item.price * item.quantity}</td>
      </tr>
    `).join('');

    const statusEmoji = {
      'Pending': '⏳',
      'Preparing': '👨‍🍳',
      'Ready': '✅',
      'Completed': '🎉',
      'Cancelled': '❌'
    };

    const mailOptions = {
      to: customerEmail,
      subject: `🍽️ Order Confirmation #${order.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9f9f9;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🍽️</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Spice Corner</h1>
              <p style="color: #fed7aa; margin: 5px 0 0 0; font-size: 14px;">Authentic Pakistani Cuisine</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 25px;">
              <!-- Success Message -->
              <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                <h2 style="color: #1a202c; margin: 0; font-size: 24px;">Thank You for Your Order!</h2>
                <p style="color: #718096; margin: 5px 0 0 0;">We've received your order and are preparing it with love ❤️</p>
              </div>
              
              <!-- Order Details -->
              <div style="background: #f7fafc; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #4a5568; font-weight: 600;">Order Number</span>
                  <span style="color: #2d3748; font-weight: 700;">${order.orderNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #4a5568; font-weight: 600;">Status</span>
                  <span style="color: #2d3748; font-weight: 700;">${statusEmoji[order.status] || ''} ${order.status}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #4a5568; font-weight: 600;">Order Type</span>
                  <span style="color: #2d3748; font-weight: 700;">${order.orderType === 'Delivery' ? '🚚 Delivery' : '🏪 Pickup'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #4a5568; font-weight: 600;">Estimated Time</span>
                  <span style="color: #2d3748; font-weight: 700;">⏱️ 20-30 minutes</span>
                </div>
              </div>
              
              <!-- Items Table -->
              <h3 style="color: #2d3748; font-size: 16px; margin: 20px 0 10px 0;">📋 Order Summary</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background: #f7fafc;">
                    <th style="padding: 10px; text-align: left; color: #4a5568;">Item</th>
                    <th style="padding: 10px; text-align: center; color: #4a5568;">Qty</th>
                    <th style="padding: 10px; text-align: right; color: #4a5568;">Price</th>
                    <th style="padding: 10px; text-align: right; color: #4a5568;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #e2e8f0;">
                    <td colspan="3" style="padding: 12px; text-align: right; font-weight: 700; font-size: 16px;">Grand Total</td>
                    <td style="padding: 12px; text-align: right; font-weight: 700; font-size: 18px; color: #f97316;">Rs ${order.totalAmount}</td>
                  </tr>
                </tfoot>
              </table>
              
              <!-- Address (if delivery) -->
              ${order.orderType === 'Delivery' ? `
                <div style="margin-top: 20px; padding: 15px; background: #f7fafc; border-radius: 8px;">
                  <h4 style="color: #2d3748; margin: 0 0 5px 0;">📍 Delivery Address</h4>
                  <p style="color: #4a5568; margin: 0;">${order.address || 'Address not provided'}</p>
                </div>
              ` : ''}
              
              <!-- Notes -->
              ${order.notes ? `
                <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                  <h4 style="color: #2d3748; margin: 0 0 5px 0;">📝 Special Instructions</h4>
                  <p style="color: #4a5568; margin: 0; font-style: italic;">${order.notes}</p>
                </div>
              ` : ''}
              
              <!-- Track Button -->
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.CLIENT_URL || 'https://elegant-maamoul-bfaab7.netlify.app'}/track/${order.orderNumber}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  🔍 Track Your Order
                </a>
                <p style="color: #a0aec0; font-size: 12px; margin-top: 10px;">
                  You can also track your order using this link anytime
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #2d3748; padding: 20px; text-align: center;">
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} Spice Corner. All rights reserved.
              </p>
              <p style="color: #718096; margin: 5px 0 0 0; font-size: 12px;">
                Questions? Contact us at <a href="mailto:info@spicecorner.com" style="color: #f97316;">info@spicecorner.com</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${customerEmail}`);
    console.log(`📧 Message ID: ${info.messageId}`);
    return true;

  } catch (error) {
    console.error('❌ Email error:', error.message);
    console.error('❌ Full error:', error);
    
    if (error.message.includes('Invalid login') || error.message.includes('535')) {
      console.error('⚠️ Gmail login failed! Please check:');
      console.error('  1. EMAIL_USER is correct: alltimefree4793@gmail.com');
      console.error('  2. EMAIL_PASS is the APP PASSWORD (16 chars with spaces)');
      console.error('  3. 2-Step Verification is enabled on your Google account');
    }
    
    return false;
  }
};

// Send Order Status Update Email
export const sendOrderStatusUpdate = async (order, customerEmail) => {
  try {
    if (!customerEmail) return false;

    const statusEmoji = {
      'Pending': '⏳',
      'Preparing': '👨‍🍳',
      'Ready': '✅',
      'Completed': '🎉',
      'Cancelled': '❌'
    };

    const statusMessages = {
      'Pending': 'Your order has been received and is waiting to be processed.',
      'Preparing': 'Your order is being prepared by our expert chefs! 🍳',
      'Ready': 'Your order is ready for pickup/delivery! 🚀',
      'Completed': 'Your order has been completed. We hope you enjoyed it! 😊',
      'Cancelled': 'Your order has been cancelled.'
    };

    const mailOptions = {
      to: customerEmail,
      subject: `📦 Order #${order.orderNumber} - Status Update`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Status Update</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9f9f9;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🍽️ Spice Corner</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 25px;">
              <h2 style="color: #2d3748;">Order Status Update</h2>
              
              <div style="background: #f7fafc; border-radius: 10px; padding: 20px; margin: 15px 0;">
                <p style="font-size: 24px; margin: 0;">${statusEmoji[order.status] || ''} <strong>${order.status}</strong></p>
                <p style="color: #4a5568; margin: 5px 0 0 0;">${statusMessages[order.status] || ''}</p>
              </div>
              
              <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                <span style="color: #4a5568;">Order Number</span>
                <span style="font-weight: 700;">${order.orderNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                <span style="color: #4a5568;">Total Amount</span>
                <span style="font-weight: 700;">Rs ${order.totalAmount}</span>
              </div>
              
              ${order.orderType === 'Delivery' && order.address ? `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #eee; margin-top: 10px;">
                  <span style="color: #4a5568;">📍 Delivery Address</span>
                  <span style="font-weight: 700; text-align: right; max-width: 200px;">${order.address}</span>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 25px;">
                <a href="${process.env.CLIENT_URL || 'https://elegant-maamoul-bfaab7.netlify.app'}/track/${order.orderNumber}" style="display: inline-block; background: #f97316; color: white; padding: 10px 25px; border-radius: 25px; text-decoration: none; font-weight: 600;">
                  🔍 Track Your Order
                </a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #2d3748; padding: 15px; text-align: center;">
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Spice Corner</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Status update email sent to ${customerEmail}`);
    return true;

  } catch (error) {
    console.error('❌ Status email error:', error);
    return false;
  }
};