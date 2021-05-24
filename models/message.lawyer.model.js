const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema for Users
const LawyerMessageSchema = new Schema({
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'conversations',
    },
    to: {
        type: Schema.Types.ObjectId,
        ref: 'client',
    },
    from: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer',
    },
    body: {
        type: String,
        required: true,
    },
    date: {
        type: String,
        default: Date.now,
    },
});

module.exports = LawyerMessage = mongoose.model('lawyerMessages', LawyerMessageSchema);
