const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create schema 
const ExperienceSchema = new Schema ({
    position: {
        type: String,
        required: true
    },
    company:{
        type: String,
        required: true
    },
    location:{
        type: String
    },
    from:{
        type: Date,
        required: true
    },
    to:{
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

 module.exports = Experience = mongoose.model('experience', ExperienceSchema);