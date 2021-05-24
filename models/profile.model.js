const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema
const ProfileSchema = new Schema({
    lawyer:{
        type: Schema.Types.ObjectId,
        ref: 'lawyer'
    },
    location:{
        type: String
    },  
    date:{
        type: Date,
        default: Date.now
    },
    languages:{
        type: Array(String)
    },
    legal_fields:{
        type: Array(String)
    },
    services:{
        type: Array(String)
    },
    gravatar: {
        type: String
    },
    short_description: {
        type: String
    },
    description: {
        type: String
    },
    career_path: {
        type: String
    },
    tariff: {
        type: Number,
        required: true
    }   
});

module.exports = Profile = mongoose.model('profile',ProfileSchema);