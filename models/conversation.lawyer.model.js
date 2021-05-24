const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema for Users
const LawyerConversationSchema = new Schema({
    client: {
        type: Schema.Types.ObjectId,
        ref: 'client',
    },
    lastMessage: {
        type: String,
    },
    date: {
        type: String,
        default: Date.now,
    },
    lawyer: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer',
    }
});

module.exports = LawyerConversation = mongoose.model(
    'lawyerConversations',
    LawyerConversationSchema
);
