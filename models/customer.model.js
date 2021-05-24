const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const CustomerSchema = new Schema ({

    customer_id:{
        type: String,
        required: true
    },

    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "company"
    },

    subscribed_date: {
        type: Date,
        default:  Date.now()
    },

    subscription_id: {
        type: String,
        default: ""
    },

    subscription: {
        type: String,
        default: ""
    },
    
    cc_attached: {
        type: Boolean,
        default: false
    }


});


module.exports = Customer = mongoose.model('customer', CustomerSchema);