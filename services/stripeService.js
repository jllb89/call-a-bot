require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { fetchProductById, createTransaction, fetchAvailableVetForProduct } = require('./firestoreService'); // Adjust the path as necessary
const { v4: uuidv4 } = require('uuid');
const OpenTok = require('opentok');
const opentok = new OpenTok(process.env.VONAGE_API_KEY, process.env.VONAGE_API_SECRET);


// Function to create a Stripe product
async function createStripeProduct(productDetails) {
    try {
        const product = await stripe.products.create({
            name: productDetails.productName,
        });

        console.log(`Stripe product created: ${product.id} for ${productDetails.productName}`);
        return product;
    } catch (error) {
        console.error(`Error creating Stripe product for ${productDetails.productName}:`, error);
        throw error; // Rethrow to handle it in the calling function
    }
}

// Function to create a price for a Stripe product
async function createPriceForProduct(productID, productDetails) {
    try {
        const price = await stripe.prices.create({
            currency: 'mxn',
            unit_amount: productDetails.price * 100,
            product_data: {
                name: productDetails.productName,
            },
        });

        console.log(`Price created for product ${productID}: ${price.id}`);
        return price;
    } catch (error) {
        console.error(`Error creating price for product ${productID}:`, error);
        throw error;
    }
}

// Function to create a payment link for a Stripe product
async function createPaymentLink(productId, customerPhoneNumber) {
    try {
        // Generate a unique room ID
        const roomID = uuidv4();
        console.log(`Generated room ID: ${roomID}`);

        // Fetch product information from Firestore using the product ID
        const productDetails = await fetchProductById(productId);
        if (!productDetails || !productDetails.isActive) {
            console.error('Product not found or is inactive in Firestore:', productId);
            return null;
        }

        // Fetch the available vet for the product
        const vet = await fetchAvailableVetForProduct({ id: productId });

        // Create a new video session
        const session = await new Promise((resolve, reject) => {
            opentok.createSession({ mediaMode: 'routed' }, (error, session) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(session);
                }
            });
        });

        // Generate separate tokens for the user and the vet
        const userToken = session.generateToken({
            role: 'publisher',  // This assumes the user is the one primarily sending the video
            expireTime: (new Date().getTime() / 1000) + (24 * 60 * 60) // Token expiry time (24 hours)
        });
        const vetToken = session.generateToken({
            role: 'subscriber',  // This assumes the vet primarily receives the video
            expireTime: (new Date().getTime() / 1000) + (24 * 60 * 60)
        });
        console.log(`Generated tokens: userToken: ${userToken}, vetToken: ${vetToken}`);

        // Construct the redirect URL for the user and the vet
        const userRedirectURL = `https://call-a-bot-7e963ac3bfd1.herokuapp.com/chat?sessionId=${session.sessionId}&token=${userToken}&room=${roomID}`;
        const vetRedirectURL = `https://call-a-bot-7e963ac3bfd1.herokuapp.com/chat?sessionId=${session.sessionId}&token=${vetToken}&room=${roomID}`;
        console.log(`Generated redirect URLs: user: ${userRedirectURL}, vet: ${vetRedirectURL}`);

        // Create the product in Stripe
        const stripeProduct = await createStripeProduct(productDetails);

        // Create a price for the Stripe product
        const price = await createPriceForProduct(stripeProduct.id, productDetails);

        // Create a payment link for the Stripe product with the user's redirect URL
        const paymentLink = await stripe.paymentLinks.create({
            line_items: [{
                price: price.id,
                quantity: 1,
            }],
            after_completion: {
                type: 'redirect',
                redirect: {
                    url: userRedirectURL,
                }
            },
            metadata: {
                sessionId: session.sessionId,
                phoneNumber: customerPhoneNumber,
                vetPhoneNumber: vet.vetPhoneNumber
            }
        });

        // Create a transaction record in Firestore with both URLs and tokens
        await createTransaction(session.sessionId, productId, customerPhoneNumber, userToken, vetToken, roomID, userRedirectURL, vetRedirectURL)
            .then(() => console.log('Transaction created successfully'))
            .catch(err => console.error('Failed to create transaction:', err));

        return { paymentLinkUrl: paymentLink.url, roomID, sessionId: session.sessionId, userToken, vetToken, userRedirectURL, vetRedirectURL };
    } catch (error) {
        console.error(`Failed to create payment link for product ID "${productId}":`, error);
        return null;
    }
}


module.exports = { createPaymentLink };