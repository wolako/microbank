const Stripe = require('stripe');

// Vérification de la clé Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    '❌ STRIPE_SECRET_KEY n\'est pas défini. Vérifie tes variables d\'environnement sur Render !'
  );
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

exports.createCheckoutSession = async ({ amount, currency, userId }) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: 'Dépôt bancaire par carte' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata: { userId, amount },
    success_url: `${process.env.FRONTEND_URL}/success`,
    cancel_url: `${process.env.FRONTEND_URL}/cancel`,
  });

  return session.url;
};
