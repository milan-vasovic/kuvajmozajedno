// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

// Define Schema for Product Model
const productSchema = new Schema({
    name: {
        type: String,
        required: true
    },

    categories: [{
        type: String,
        required: true
    }],

    tags: [{
        type: String,
        required: true
    }],

    shortDescription: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: true
    },

    featureImage: {
        type: String,
        required: true
    },

    images: [{
        type: String
    }],

    size: {
        type: String,
        required: true
    },

    color: {
        type: String,
        required: true
    },

    cost: {
        type: Number,
        required: true,
        default: 0
    },

    price: {
        type: Number,
        required: true,
        default: 0
    },

    actionPrice: {
        type: Number
    },

    weight: {
        type: String
    },

    createdAt: {
        type: Date,
        required: true
    },

    views: {
        count: {
            type: Number,
            required: true,
            default: 0,
        },
        users: [{
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User",
            },
            expiration: {
                type: Date,
                required: true,
            }
        }]
    },

    history: [{
        historyId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "History"
        }
    }],

    // Buyers
    buyers: [{
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
        }
    }],
});

// Exports product Schema
module.exports = mongoose.model("Product", productSchema);