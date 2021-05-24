const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema for Users
const MessageSchema = new Schema({
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'conversations',
    },
    client: {
        type: Schema.Types.ObjectId,
        ref: 'client',
    },
    lawyer: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer',
    },
    body: {
        type: String,
        required: true,
    },
    sender: {
        type: Schema.Types.ObjectId
    },
    date: {
        type: String,
        default: Date.now,
    },
});

module.exports = Message = mongoose.model('messages', MessageSchema);
