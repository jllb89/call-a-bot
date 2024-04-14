const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { updateTransactionPaidStatus, fetchTransaction, createCustomer } = require('./services/firestoreService');
const { sendVetPaymentLink } = require('./controllers/vetsController');


router.post('/', express.raw({ type: 'application/json' }), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_ENDPOINT_SECRET);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const sessionId = session.metadata.sessionId;
        const paymentIntentId = session.payment_intent;
        const userEmail = session.customer_details.email;
        const userName = session.customer_details.name;
        const vetPhoneNumber = session.metadata.vetPhoneNumber;
        const paymentLinkId = session.payment_link;
        const transaction = await fetchTransaction(sessionId);

        // Update transaction status
        await updateTransactionPaidStatus(sessionId, true, paymentIntentId, userEmail, userName);

        // Deactivate the payment link
        try {
            await stripe.paymentLinks.update(paymentLinkId, {
                active: false
            });
            console.log('Payment link deactivated successfully');
        } catch (error) {
            console.error('Failed to deactivate payment link:', error);
        }

        // Create a customer record
        createCustomer(vetPhoneNumber, userName, userEmail);

        // Send a payment link message to the vet
        sendVetPaymentLink(vetPhoneNumber, sessionId);
    }

    response.json({ received: true });
});


module.exports = router;