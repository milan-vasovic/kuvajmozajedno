// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

// Define Schema for Topic Model
const topicSchema = new Schema({
    title: {
        type: String,
        required: true
    },

    shortDescription: {
        type: String,
        required: true
    },

    pageKeyWords: [{
        type: String,
        required: true
    }],

    content: [{
        type: String,
        required: true
    }],

    category: [{
        type: String,
        required: true
    }],

    bannerImage: {
        type: String,
    },

    video: {
        type: String
    },
    
    author: {
        authorId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
        },
        username: {
            type: String,
            required: true
        },
        userImage: {
            type: String,
            required: true
        }
    },

    comments: [
        {
            author: {
                authorId: {
                    type: Schema.Types.ObjectId,
                    required: true,
                    ref: "User"
                },
                username: {
                    type: String,
                    required: true
                },
                userImage: {
                    type: String,
                    required: true
                }
            },
            content: {
                type: String,
                required: true
            },
            createdAt: {
                type: Date,
                required: true
            }
        }
    ],

    likes : {
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
});

// Exports topic Schema
module.exports = mongoose.model("Topic", topicSchema);