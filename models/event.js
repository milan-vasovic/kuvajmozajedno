const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

// Define Schema for Event Model
const eventSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    description: [{
        type: String,
        required: true
    }],

    category: {
        type: String,
        required: true
    },

    rules: [{
        type: String,
        required: true
    }],

    image: {
        type: String,
        required: true
    },

    startDate: {
        type: Date,
        required: true
    },

    endDate: {
        type: Date,
        required: true
    },

    type: {
        type: String,
        required: true
    },

    cost: {
        type: Number,
        required: true,
        default: 0
    },

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

    participants: [{
        userId: {
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
        },

        place: {
            type: Number
        },

        isWinner: {
            type: Boolean,
            required: true,
            default: false
        }
    }],

    rewards: [{
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },

        image: {
            type: String,
            required: true
        }
    }],

    content: [{
        author: {
            userId: {
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

        recipe: {
            recipeId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "Recipe"
            },
            title: {
                type: String,
                required: true,
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
        },

        votes: {
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
        }
    }]
});

// Exports event Schema
module.exports = mongoose.model("Event", eventSchema);