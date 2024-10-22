// Import mongoose
const mongoose = require('mongoose');

// Use Schema from mongoose
const Schema = mongoose.Schema;

// Define Schema for User Model
const userSchema = new Schema({
    // Username
    username: {
        type: String,
        required: true,
    },

    // Email
    email: {
        type: String,
        required: true,
    },

    // Password
    password: {
        type: String,
        required: true,
    },

    // User Image
    userImage: {
        type: String,
        required: true,
    },

    // Role
    role: {
        type: String,
        required: true,
    },

    // Reset Token
    resetToken: {
        type: String,
    },

    // Reset Token Expiration
    resetTokenExpiration: {
        type: Date,
    },

    // Confirm Token
    confirmToken: {
        type: String,
    },

    // Confirm Token Expiration
    confirmTokenExpiration: {
        type: Date,
    },

    // Withdrawal Token
    withdrawalToken: {
        type: String,
    },

    //Withdrawal Token Expiration
    withdrawalTokenExpiration: {
        type: Date,
    },

    //Deposit Request Expiration
    depositRequestExpiration: {
        type: Date,
    },

    // User Recipes - list of recipes that this user created
    userRecipes: [{
        recipeId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Recipe",
        }
    }],

    // Saved Recipes - list of recipes that user saved from other users
    savedRecipes: [{
        recipeId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Recipe",
        }
    }],

    // User Books - list of books that this user created
    userBooks: [{
        bookId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Book",
        }
    }],

    // Saved Books - list of books that user saved from other users
    savedBooks: [{
        bookId: {
            type: Schema.Types.ObjectId,
            ref: "Book",
            required: true,
        }
    }],

    // Followers - object that contains count and list of users that follow this user
    followers: {
        count: {
            type: Number,
            default: 0,
            required: true,
        },
        users: [{
            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            }
        }]
    },

    // Following - object that contains count and list of users that this user is following
    following: {
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
            }
        }]
    },

    // Views - object that contain count and list of users that viewed this user and expiration
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

    blocking: [
        {
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            }
        }
    ],

    blockedBy: [
        {
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            }
        }
    ],

    subscribers: {
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
            expirationDate: {
                type: Date,
                required: true
            }
        }] 
    },

    subscribed: {
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
            expirationDate: {
                type: Date,
                required: true
            }
        }] 
    },

    subCost: {
        type: Number,
        required: true,
        default: 0
    },

    // Acceptance
    acceptance: {
        type: Boolean,
        required: true,
        default: true,
    },

    boughtRecipes: [
        {
            purchaseId: {
                type: Object,
                required: true,
                ref: "Purchase"
            }
        }
    ],

    boughtBooks: [
        {
            purchaseId: {
                type: Object,
                required: true,
                ref: "Purchase"
            }
        }
    ],

    status: [{
        type: String,
        required: true
    }],

    history: [{
        historyId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "History"
        }
    }],

    // Confirmed    
    confirmed: {
        type: Boolean,
        default: false,
    },

    wallet: {
        type: Number,
        default: 0,
        required: true
    },

    systemWallet: {
        type: Number,
    },

    lastLogin: {
        type: Date
    },

    suspendDate: {
        type: Date
    },
    
    deleteDate: {
        type: Date
    }
});

// Exports User Schema
module.exports = mongoose.model("User", userSchema);