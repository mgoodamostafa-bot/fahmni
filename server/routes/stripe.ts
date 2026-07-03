import { Router } from 'express';
import express from 'express';
import { getAdminDb, getStripe, cleanData } from '../lib/middleware.js';

const router = Router();

// Webhook endpoint needs raw body
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).send('Webhook secret or signature missing');
    return;
  }

  let event: any;
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const courseId = session.metadata?.courseId;

    if (userId && courseId) {
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          await adminDb.collection('enrollments').doc(`${userId}_${courseId}`).set({
            userId,
            courseId,
            status: 'active',
            paymentMethod: 'stripe',
            createdAt: new Date().toISOString(),
            stripeSessionId: session.id
          });
          console.log(`Enrolled user ${userId} in course ${courseId}`);
        } catch (error) {
          console.error('Error updating enrollment:', error);
        }
      }
    }
  }

  res.json({ received: true });
});

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { courseId, courseTitle, price, userId, userEmail } = req.body;

    if (!courseId || !courseTitle || price === undefined || !userId) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const stripe = await getStripe();
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'dummy_key') {
      res.status(500).json({ error: 'Stripe is not configured.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: courseTitle },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/courses/${courseId}`,
      customer_email: userEmail,
      metadata: { userId, courseId }
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
