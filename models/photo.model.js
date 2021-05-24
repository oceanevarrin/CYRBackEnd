const { ObjectID } = require('mongodb');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema for Users
const PhotoSchema = new Schema({
    type: String,
    data: Buffer,
    lawyer: {
        type: Schema.Types.ObjectId,
        ref: 'lawyer'
    }
});

module.exports = Photo = mongoose.model('photos', PhotoSchema);
