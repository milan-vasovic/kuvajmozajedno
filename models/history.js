// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

const historySchema = new Schema({
    // Type
    type: {
        type: String,
        required: true,
    },

    // Date
    date: {
        type: Date,
        required: true
    },

    // Cost
    cost: {
        type: Number,
        required: true
    },

    // Purchase
    purchaseId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Purchase"
    }
})

// Exports History Schema
module.exports = mongoose.model("History", historySchema);