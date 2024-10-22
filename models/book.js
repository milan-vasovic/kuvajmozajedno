// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

// Define Schema for Book Model
const bookSchema = new Schema({
    // Title
    title: {
        type: String,
        required: true
    },

    // Description
    description: {
        type: String,
        required: true
    },

    // Cover Image
    coverImage: {
        type: String,
        required: true
    },

    // Author referenc to User
    author: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },
    
    // List of recipes that is reference to Recipe
    recipes: [{
        recipeId: 
        {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Recipe"
        }
    }],

    // Saves object that contains count and list of users that reference to User
    saves: {
        count: {
            type: Number,
            required: true,
            default: 0
        },
        users: [{
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            }
        }]
    },

    // Views object that contains count and list of users that reference to User and expiration
    views: {
        count: {
            type: Number,
            required: true,
            default: 0
        },
        users: [{
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            },
            expiration: {
                type: Date,
                required: true
            }
        }]
    },

    // Type
    type: {
        type: String,
        required: true
    },

    // Cost
    cost: {
        type: Number,
        required: true,
        default: 0
    },

    // Buyers
    buyers: [{
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
        }
    }],

    // Histroy
    history: [{
        historyId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "History"
        }
    }],

    // CreatedAt
    createdAt: {
        type: Date,
        required: true
    }
});

// Exports Book Schema
module.exports = mongoose.model("Book", bookSchema);