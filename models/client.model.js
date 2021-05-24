const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const ClientSchema = new Schema ({
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    email:{
        type: String,
        required:true
    },
    role: {
        type: String,
        default: "user"
    },
    password:{
        type: String,
        // required:true
    },
    resetPasswordExpires: {
        type: Date
    },
    resetPasswordToken: {
        type: String,
        default: ""
    },
    is_subscribed:{
        type: Boolean,
        default: false
    },
    isUser:{
        type: Boolean,
        default: true
    },
    expiry_date: {
        type: Date,
    },
    registerd_date: {
        type: Date
    },
});
 module.exports = Client = mongoose.model('client', ClientSchema);