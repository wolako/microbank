const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.createCheckoutSession = async ({ amount, currency, userId }) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: 'Dépôt bancaire par carte',
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata: {
      userId,
      amount,
    },
    success_url: 'https://yourbank.com/success',
    cancel_url: 'https://yourbank.com/cancel',
  });

  return session.url;
};
