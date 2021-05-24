const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema for Users
const PaymentSchema = new Schema({
    client: {
        type: Schema.Types.ObjectId,
        ref: 'client',
    },
    lawyer: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer',
    },
    customer_id: {
        type: String,
        required: true,
    },
    token_id: {
        type: String,
        // required: true,
    },
    card_id: {
        type: String,
        // required: true,
    },
    date: {
        type: String,
        default: Date.now,
    },
    has_card: {
        type: Boolean,
        default: false
    }
});

module.exports = Payment = mongoose.model(
    'payment',
    PaymentSchema
);
