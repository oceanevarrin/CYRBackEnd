const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const ContractSchema = new Schema ({
    contract_title: {
        type: String,
        required: true
    },
    client: {
        type: Schema.Types.ObjectId,
        ref: 'client'
    },
    lawyer: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer'
    },
    client_agreed: {
        type: String,
        default: "none"
    },
    lawyer_agreed: {
        type: String,
        default: "none"
    },
    payment_amount: {
        type: Number,
        required: true,
        default: 0
    },
    deadline: {
        type: Date,
        required: false
    },
    status: {
        type: String,
        default: 'incomplete'
    },
    paid: {
        type: Boolean,
        default: false
    }
});

 module.exports = Contract = mongoose.model('contract', ContractSchema);
 