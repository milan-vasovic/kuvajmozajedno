// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

const purchaseSchema = new Schema({
    data: {
        type: Object,
        required: true,
    }
})

// Exports History Schema
module.exports = mongoose.model("Purchase", purchaseSchema);