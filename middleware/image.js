const User = require("../models/user");
const Recipe = require("../models/recipe");
const Book = require("../models/book");
const path = require('path');
const Topic = require("../models/topic");
const Event = require("../models/event");

module.exports = async (req, res, next) => {
    try {
        const lockedImagePath = "/images/locked.png";
        const param = req.params.imagePath
        let imagePath = '';
        if (param.includes('.png') || param.includes('.jpg') || param.includes('.jpeg')) {
            imagePath = "/images/" + req.params.imagePath;
        } else {
            imagePath = "/images/uploads/" + req.params.imagePath;
        }

        const isGuest = req.session.guest;

        if (!isGuest) {
            if (req.session.user.role === "admin" || req.session.user.role === "system") {
                return next();
            }

            const userId = req.session.user._id;
            const loggedUser = await User.findOne({ _id: userId }).select('subscribed');

            const user = await User.findOne({ 'userImage': imagePath }).select("userImage");

            if (user) {
                return next();
            }
            
            const book = await Book.findOne({ 'coverImage': imagePath })
                    .populate('buyers.userId', '_id');

            if (book) {
                    const isAuthor = book.author.toString() === userId.toString();
                    const isSub = loggedUser.subscribed.users.some(sub => sub.userId.toString() === book.author.toString() && book.type === "private");
                    const isBuyer = book.buyers.some(buyer => buyer.userId._id.toString() === userId.toString() && book.type === 'protected');
                    const isPublic = book.type === 'public';

                    if (isAuthor || isSub || isBuyer || isPublic) {
                        req.isProtected = true;
                        return next();
                    }

                    const error = new Error("Unauthorized");
                    error.httpStatusCode = 403;
                    return next(error);
                }

                const recipe = await Recipe.findOne({
                    $or: [
                        { 'featureImage': imagePath },
                        { 'images': imagePath }
                    ]
                }).populate('buyers.userId', "_id");

                if (recipe) {
                    const isAuthor = recipe.author.toString() === userId.toString();
                    const isSub = loggedUser.subscribed.users.some(sub => sub.userId.toString() === recipe.author.toString() && recipe.type === "private");
                    const isBuyer = recipe.buyers.some(buyer => buyer.userId._id.toString() === userId.toString() && recipe.type === 'protected');
                    const isPublic = recipe.type === 'public';

                    const books = await Book.find({
                        $and: [
                            { buyers: { $elemMatch: { userId: userId } } },
                            { recipes: { $elemMatch: { recipeId: recipe._id } } }
                        ]
                    }).select("recipes buyers").catch(err => new Error(err));

                    let hasBoughtBook = books.length > 0 && books.some(book => book.buyers.some(buyer => buyer.userId.toString() === userId.toString()));

                    if (isAuthor || isSub || isBuyer || isPublic || hasBoughtBook) {
                        req.isProtected = true;
                        return next();
                    }

                    const error = new Error("Unauthorized");
                    error.httpStatusCode = 403;
                    return next(error);
                }

                const topic = await Topic.findOne({'bannerImage' : imagePath});

                if (topic) {
                    return next();
                }

                
                const event = await Event.findOne({'image': imagePath});

                if (event) {
                    return next();
                }

                if (!recipe && !book && !topic && !event && (lockedImagePath === imagePath)) {
                    return next();
                }

                if (imagePath == '/images/kuvajmozajedno_hero.png' || imagePath == '/images/fitnesfamilija_hero.png') {
                    return next();
                }

                const error = new Error("There is no such image! " + imagePath);
                error.httpStatusCode = 500;
                return next(error);
            }        

        const user = await User.findOne({ 'userImage': imagePath }).select("userImage");

        if (user) {
            return next();
        }

        const recipe = await Recipe.findOne({
            $or: [
                { 'featureImage': imagePath },
                { 'images': imagePath }
            ]
        });

        if (recipe) {
            if (recipe.type === "public") {
                return next();
            }
            const error = new Error("Unauthorized!");
            error.httpStatusCode = 403;
            return next(error);
        }

        const book = await Book.findOne({ 'coverImage': imagePath });

        if (book) {
            if (book.type === "public") {
                return next();
            }

            const error = new Error("Unauthorized!");
            error.httpStatusCode = 403;
            return next(error);
        }

        const topic = await Topic.findOne({'bannerImage' : imagePath});

        if (topic) {
            return next();
        }

        const event = await Event.findOne({'image': imagePath});

        if (event) {
            return next();
        }

        if (imagePath == '/images/kuvajmozajedno_hero.png' || imagePath == '/images/fitnesfamilija_hero.png') {
            return next();
        }

        const error = new Error("There is no such image!");
        error.httpStatusCode = 500;
        return next(error);

    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
};
