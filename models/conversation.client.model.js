const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema for Users
const ClientConversationSchema = new Schema({
    lawyer: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer',
    },
    lastMessage: {
        type: String,
    },
    date: {
        type: String,
        default: Date.now,
    },
    client: {
        type: Schema.Types.ObjectId,
        ref: 'client',
    }
});

module.exports = ClientConversation = mongoose.model(
    'clientConversations',
    ClientConversationSchema
);
