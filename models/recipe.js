// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

// Define Schema for Recipe Model
const recipeSchema =  new Schema({
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

    // Feature Image
    featureImage: {
        type: String,
        required: true
    },

    // Author referenc to User
    author: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },

    // List of Categories 
    category: [{
        type: String
    }],

    // List of Images
    images: [{
        type: String
    }],

    // List of Ingredinets that contains name and amount
    ingredients: [{
        name: {
            type: String,
            required: true
        },
        amount: {
            type: String,
            required: true
        }
    }],

    // Preparation object that contain duration, note and list of steps
    preparation: {
        duration: {
            type: String,
            required: true
        },
        note: {
            type: String
        },
        steps: [{
            type: String,
            required: true
        }]
    },

    // List of Nutritions containing name and amount
    nutritions: [{
        name: {
            type: String,
            required: true
        },
        amount: {
            type: String,
            required: true
        }
    }],

    // List of Ratings that containe userId that is reference to User and stars
    ratings: [{
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
        },
        stars: {
            type: Number,
            required: true
        }
    }],

    // Views object that contains count and list of users with reference to User and expiration
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

    // Saves object that contains count and list of users with reference to User
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

    // History
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
    },

    shownDate: {
        type: Date
    },

    cooldownDate: {
        type: Date
    }

});

// Exports Recipe Schema
module.exports = mongoose.model("Recipe", recipeSchema);