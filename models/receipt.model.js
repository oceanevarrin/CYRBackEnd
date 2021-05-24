const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const ReceiptSchema = new Schema ({
    contract: {
        type: Schema.Types.ObjectId,
        ref: 'contract'
    },
    client: {
        type: Schema.Types.ObjectId,
        ref: 'client'
    },
    to: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer'
    }
});

 module.exports = Receipt = mongoose.model('receipt', ReceiptSchema);
 