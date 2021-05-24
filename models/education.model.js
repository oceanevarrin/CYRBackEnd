const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const EducationSchema = new Schema ({
    institution: {
        type: String,
        required: true
    },
    education_level: {
        type: String,
        required: true
    },
    field_of_study: {
        type: String,
        required: true
    },
    from: {
        type: Date,
        required: true
    },
    to: {
        type: Date
    },
    current:{
        type: Boolean,
        default: false
    },
    description:{
        type: String
    },
    lawyer:{
        type: Schema.Types.ObjectId,
        ref: 'lawyer'
    }
});

 module.exports = Education = mongoose.model('education', EducationSchema);
 