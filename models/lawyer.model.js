const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const LawyerSchema = new Schema ({
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
    status:{
        type: String,
        required: true,
        default: "inactive"
    },
    role:{
        type: String,
        required: true,
        default: "lawyer"
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
    clients: {
        type: Array(Schema.Types.ObjectId),
        ref: 'client'
    },
    rating:{
        type: Number,
        default: 0
    },
    approval_requested:{
        type: Boolean,
        default: false
    },
    profile_built: {
        type: Boolean,
        default: false
    },
    balance: {
        type: Number,
        default: 0
    }
});

 module.exports = Lawyer = mongoose.model('lawyer', LawyerSchema);