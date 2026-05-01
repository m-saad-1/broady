const crypto = require('crypto');
const API_URL = process.env.API_URL || 'http://localhost:3000';
const SECRET = process.env.PAYMENT_SECRET || 'test_secret';

const payload = {
  orderId: 'smoke-123',
  status: 'PAID',
  amount: 100,
  currency: 'USD',
  reference: 'smoke-test'
};

const body = JSON.stringify(payload);
const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');

(async () => {
  try {
    const res = await fetch(`${API_URL}/api/orders/payments/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-broady-payment-signature': sig
      },
      body
    });
    console.log('Response status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Error sending smoke webhook:', err);
    process.exit(1);
  }
})();
