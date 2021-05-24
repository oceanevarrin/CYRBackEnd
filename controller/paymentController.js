/**
 * 
 * paymentController
 * 
 */


// dot env
require("dotenv").config();

const stripe = require('stripe')("sk_test_51ID6YEF9yH26c5FnC5HIeMHD9zWOztyjNrmHAatXpvWe6dPEvupDYudd9siU2xFSRH42yRqZkyEGaXK57FNkdmj500Sd6TgjQK");



// create stripe customers
let createStripeCustomer = function(desc, email, name, phone) {

    return stripe.customers.create({
        description: desc,
        email: email,
        name: name,
        phone: phone
    });

}


let createPaymentMethod = function(cc, exp_month, exp_year, cvc, name) {

    return stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: cc,
          exp_month: exp_month,
          exp_year: exp_year,
          cvc: cvc,
        },
        billing_details: {
            name: name
        }
    });

}


let createPaymentCardToken = function(cc, exp_month, exp_year, cvc, name) {

    return stripe.tokens.create({
        card: {
          number: cc,
          exp_month: exp_month,
          exp_year: exp_year,
          cvc: cvc,
          name: name
        },
      });

}


// attach payment method to customer
let attachPaymentMethod = function(payment_method, customer_id) {

    return stripe.paymentMethods.attach(
        payment_method,
        {customer: customer_id}
    );

}


let attachPaymentSource = function(customer_id, card_token) {

    return stripe.customers.createSource(
        customer_id,
        {source: card_token}
    );

}

// update card token
let updatePaymentSource = function(customer_id, card_token) {

    return stripe.customers.update(
        customer_id,
        {source: card_token}
    );

}


// get all customers
let getCustomers = function(limit) {

    return stripe.customers.list({
        limit: limit,
      });

}



// get customer by id
let getCustomerByID = function(customer_id) {

    return stripe.customers.retrieve(
        customer_id
    );

}



// list all products
let getProducts = function(limit) {

    return stripe.products.list({
        limit: limit,
      });

}


// get products by id
let getProductById = function(pid) {

    return stripe.products.retrieve(
        pid
    );

}



// get all subscriptions
let getSubscriptions = function(limit) {

    return stripe.subscriptions.list({
        limit: 3,
    });

}



// subscribe a customer
let subscribeCustomer = function(cid, price_id) {

    return stripe.subscriptions.create({
        customer: cid,
        items: [
          {price: price_id},
        ],
      });

}


// cancel subscription
let cancelSubscription = function(sid) {

    return stripe.subscriptions.del(
        sid
    );

}


// get all prices
let getAllPrices = function(limit) {
    
    return stripe.prices.list({
        limit: limit,
    });

}



// get subscription price
let getPlanPrice = function(subType) {

    let subPlan = "";

    if (subType === "ClaimYourRights") subPlan = 5;

    return subPlan;

}



module.exports = {

    createStripeCustomer,
    createPaymentMethod,
    attachPaymentMethod,
    subscribeCustomer,
    createPaymentCardToken,
    attachPaymentSource,
    cancelSubscription,
    getCustomerByID,
    getPlanPrice,
    updatePaymentSource

}

