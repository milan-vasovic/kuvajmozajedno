// Controllers for user routes and function to the database
const mongoose = require("mongoose");

// Import Models to be used and passed to template
const crypto = require("crypto");

const User = require("../models/user");
const Recipe = require("../models/recipe");
const Book = require("../models/book");
const Purchase = require("../models/purchase");
const History = require("../models/history");
const Topic = require('../models/topic');
const Event = require('../models/event');

const nodemailer = require("nodemailer");

const { validationResult } = require("express-validator");

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const cloudinary = require('../middleware/cloudinary-config');

const { deleteImage } = require("../util/cloudinaryServices");
const uploadImage = require("../util/cloudinaryServices").uploadImage;

// Učitavanje ključeva
const publicKey = fs.readFileSync(path.join(__dirname, '../keys', 'publicKey.pem'), 'utf8');
const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'privateKey.pem'), 'utf8');

const ITEMS_PER_PAGE = 4;

// Funkcije za generisanje ključa i IV, šifrovanje i dešifrovanje
const generateKeyAndIV = () => {
    const key = crypto.randomBytes(32); // 256-bit ključ
    const iv = crypto.randomBytes(16); // 128-bit IV
    return { key, iv };
};

const encryptData = (text, key, iv) => {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

const encryptAESKey = (aesKey, publicKey) => {
    const encryptedKey = crypto.publicEncrypt(publicKey, aesKey);
    return encryptedKey.toString('hex');
};

const decryptAESKey = (encryptedAESKey, privateKey) => {
    const aesKeyBuffer = Buffer.from(encryptedAESKey, 'hex');
    const decryptedKey = crypto.privateDecrypt(privateKey, aesKeyBuffer);
    return decryptedKey;
};

const decryptData = (encryptedData, key, iv) => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// Setting trasporter
let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_AUTH_USER,
        pass: process.env.EMAIL_AUTH_PASS,
    },
});

async function getAllCategories(filePath) {
    try {
        const data = await fsp.readFile(filePath, 'utf-8');
        const allCategories = JSON.parse(data);
        return allCategories;
      } catch (err) {
        throw new Error('Error reading JSON file: ' + err);
      }
}

//------------------------------------------ GET Functions --------------------------------------------------

exports.getMyProfile = (req, res, next) => {
    try {
        // Get userId form request.user
        const userId = req.session.user._id;
        const loginUser = req.session.user._id;

        // Fetch user with his data from database
        User.findById(userId)
            .select("-password -acceptance -confirmed -__v")
            .populate({
                path: 'userRecipes.recipeId savedRecipes.recipeId',
                populate: {
                    path: 'author',
                    select: 'userImage username'
                },
                select: 'title category author description featureImage preparation.duration ratings type cost'
            }).populate({
                path: 'userBooks.bookId savedBooks.bookId',
                populate: {
                    path: 'author',
                    select: "userImage username"
                },
                select: 'title author description coverImage recipes type cost'
            })
            .populate(
                'followers.users.userId following.users.userId', 'username userImage'
            )
            .populate(
                'blocking.userId', 'username userImage'
            )
            .populate({
                path: 'subscribers.users',
                slecet: 'userId',
                populate: [{
                    path: 'userId',
                    select: 'username userImage'
                }]
            })
            .populate({
                path: 'subscribed.users',
                slecet: 'userId',
                populate: [{
                    path: 'userId',
                    select: 'username userImage'
                }]
            })
            .populate({
                path: 'boughtRecipes',
                select: 'purchaseId',
                populate: [
                    {
                        path: 'purchaseId',
                        select: 'data',
                        populate: {
                            path: 'data.userId',
                            model: 'User',
                            select: 'username userImage'
                        }
                    }
                ]
            })
            .populate({
                path: 'boughtBooks',
                select: 'purchaseId',
                populate: [
                    {
                        path: 'purchaseId',
                        select: 'data',
                        populate: {
                            path: 'data.userId',
                            model: 'User',
                            select: 'username userImage',
                        }
                    }
                ]
            })
            .populate({
                path: 'history.historyId',
                select: 'type date cost purchaseId',
                populate: [
                    {
                        path: 'purchaseId',
                        select: 'data.title data.author data.userId data.username data.userImage data.dataTitle userId',
                        populate: {
                            path: 'data.author data.userId',
                            model: 'User',
                            select: 'username userImage'
                        }
                    }
                ]
            })
            .then(user => {
                // Render myProfile page and show the data
                return res.status(200).render('user/my-profile', {
                    path: '/moj-profil',
                    pageTitle: 'Moj Profil',
                    pageDescription: "",
                    pageKeyWords: "",
                    user: user,
                    loginUser: loginUser,
                })
            })
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getMyFeed = async (req, res, next) => {
    try {
        let searchCond, searchCategory;

        const page = Math.max(1, +req.query.page || 1);

        let recipePageTotalItems, pageTotalItems, bookPageTotalItems;

        const loggedUserId = req.session.user._id;
        let recipes = [];
        let books = [];
        let content = [];

        const userWallet = await User.findById(loggedUserId).select("wallet");

        const followingUsers = await User.findById(loggedUserId).select("following.users.userId");

        const followingUsersIds = followingUsers.following.users.map(user => user.userId);

        recipePageTotalItems = await Recipe.find({ author: { $in: followingUsersIds } })
            .countDocuments();

        bookPageTotalItems = await Book.find({ author: { $in: followingUsersIds } })
            .countDocuments();

        pageTotalItems = recipePageTotalItems > bookPageTotalItems ? recipePageTotalItems : bookPageTotalItems;

        const lastPage = Math.max(1, Math.ceil(pageTotalItems / ITEMS_PER_PAGE));

        const followingRecipes = await Recipe.find({ author: { $in: followingUsersIds } })
            .sort({ "createdAt": -1 })
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .select("_id type title featureImage category description preparation.duration ratings createdAt author cost")
            .populate("author", "username userImage role")
            .catch(err => {
                const error = new Error("Nije moguće pronaći Recepte!");
                error.httpStatusCode = 404;
                return next(error);
            });

        const followingBooks = await Book.find({ author: { $in: followingUsersIds } })
            .sort({ "createdAt": -1 })
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .select("_id type title coverImage description createdAt recipes author cost")
            .populate("author", "username userImage role")
            .catch(err => {
                const error = new Error("Nije moguće pronaći Knjige!");
                error.httpStatusCode = 404;
                return next(error);
            })

        // Filtriranje recepata i provera da li je trenutni korisnik pretplaćen na autora privatnih recepata
        for (let recipe of followingRecipes) {
            if (recipe.type === "private") {
                const author = await User.findById(recipe.author)
                    .select("subscribers.users.userId")
                    .catch(err => {
                        const error = new Error("Nije moguće pronaći Korisnike!");
                        error.httpStatusCode = 404;
                        return next(error);
                    })

                const subscribersIds = author.subscribers.users.map(subscriber => subscriber.userId.toString());

                if (subscribersIds.includes(loggedUserId.toString())) {
                    recipes.push(recipe);
                } else {
                    recipes.push({
                        _id: recipe._id,
                        title: recipe.title,
                        author: recipe.author,
                        type: recipe.type,
                        ratings: recipe.ratings,
                        description: recipe.description,
                        preparation: { duration: recipe.preparation.duration },
                        featureImage: "/images/locked.png",
                        category: recipe.category,
                        cost: recipe.cost,
                        createdAt: recipe.createdAt,
                        cond: true
                    })
                }
            }
            else if (recipe.type === "protected") {
                const buyers = await Recipe.findById(recipe._id)
                    .select("buyers")
                    .catch(err => {
                        const error = new Error("Nije moguće pronaći Recept!");
                        error.httpStatusCode = 404;
                        return next(error);
                    })

                const buyersIds = buyers.buyers.map(buyer => buyer.userId.toString());
                if (buyersIds.includes(loggedUserId.toString())) {
                    recipes.push(recipe);
                } else {
                    recipes.push({
                        _id: recipe._id,
                        title: recipe.title,
                        type: recipe.type,
                        author: recipe.author,
                        description: recipe.description,
                        ratings: recipe.ratings,
                        preparation: { duration: recipe.preparation.duration },
                        featureImage: "/images/locked.png",
                        category: recipe.category,
                        cost: recipe.cost,
                        createdAt: recipe.createdAt,
                        cond: true
                    })
                }
            } else {
                recipes.push(recipe);
            }
        }

        for (let book of followingBooks) {
            if (book.type === "private") {
                const author = await User.findById(book.author)
                    .select("subscribers.users.userId")
                    .catch(err => {
                        const error = new Error("Nije moguće pronaći Korisnika!");
                        error.httpStatusCode = 404;
                        return next(error);
                    })

                const subscribersIds = author.subscribers.users.map(subscriber => subscriber.userId.toString());
                if (subscribersIds.includes(loggedUserId.toString())) {
                    books.push(book);
                } else {
                    books.push({
                        _id: book._id,
                        title: book.title,
                        author: book.author,
                        description: book.description,
                        coverImage: "/images/locked.png",
                        type: book.type,
                        recipes: book.recipes.length,
                        cost: book.cost,
                        createdAt: book.createdAt,
                        cond: true
                    })
                }
            }
            else if (book.type === "protected") {
                const buyers = await Book.findById(book._id)
                    .select("buyers")
                    .catch(err => {
                        const error = new Error("Nije moguće pronaći Knjigu!");
                        error.httpStatusCode = 404;
                        return next(error);
                    })

                const buyersIds = buyers.buyers.map(buyer => buyer.userId.toString());
                if (buyersIds.includes(loggedUserId.toString())) {
                    books.push(book);
                } else {
                    books.push({
                        _id: book._id,
                        title: book.title,
                        author: book.author,
                        description: book.description,
                        coverImage: "/images/locked.png",
                        type: book.type,
                        recipes: book.recipes.length,
                        cost: book.cost,
                        createdAt: book.createdAt,
                        cond: true
                    })
                }
            } else {
                books.push(book);
            }
        }

        // Combine recipes and books into content array
        content = [...recipes, ...books];

        content = content.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).render("user/my-feed", {
            path: '/novosti',
            pageTitle: "Novosti",
            pageDescription: "",
            pageKeyWords: "",
            content: content,
            wallet: +userWallet.wallet,
            currentPage: page,
            hasNextPage: ITEMS_PER_PAGE * page < pageTotalItems,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: lastPage,
            searchCond: searchCond,
            searchCategory: searchCategory,
        });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getUserProfile = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const loginUser = req.session.user;

        const userWallet = await User.findById(loginUser._id).select("wallet");

        if (userId.toString() === loginUser._id.toString()) {
            return res.status(200).redirect("/moj-profil");
        }

        const blockedUsers = await User.findById(loginUser._id)
            .select('-_id blocking blockedBy')
            .catch(err => {
                const error = new Error("Nije moguće pronaći Blokirane Korisnike!");
                error.httpStatusCode = 500;
                return next(error);
            });

        const isBlocking = blockedUsers.blocking.find(bUser => bUser.userId.toString() === userId.toString());
        const isBlocked = blockedUsers.blockedBy.find(bUser => bUser.userId.toString() === userId.toString());

        if (isBlocking) {
            User.findById(userId)
                .select('_id username userImage')
                .then(user => {
                    return res.status(200).render('user/new-user-profile', {
                        path: '/korisnik-profil',
                        pageTitle: 'Profil Korisnika',
                        pageDescription: "",
                        pageKeyWords: "",
                        user: {
                            _id: user._id,
                            username: user.username,
                            userImage: user.userImage,
                        },
                        loginUser: loginUser,
                        isBlocked: false,
                        isBlocking: true
                    });
                });
        } else if (isBlocked) {
            return res.status(200).render('user/new-user-profile', {
                path: '/korisnik-profil',
                pageTitle: 'Profil Korisnika',
                pageDescription: "",
                pageKeyWords: "",
                isBlocked: true,
                isBlocking: false
            });
        } else {
            // Fetch user with his data from database
            const user = await User.findById(userId)
                .select("_id username userImage followers following subscribers views role subCost userRecipes userBooks")
                .populate({
                    path: 'userRecipes.recipeId',
                    populate: {
                        path: 'author',
                        select: 'userImage username'
                    },
                    select: 'title category author description featureImage preparation.duration ratings type cost buyers'
                }).populate({
                    path: 'userBooks.bookId',
                    select: 'title author description coverImage recipes type cost buyers',
                    populate: [{
                        path: 'author',
                        select: "userImage username"
                    },
                    {
                        path: 'recipes',
                        model: 'Book',
                        select: 'title description coverImage recipes previousVersions __v',
                        populate: {
                            path: 'recipes.recipeId',
                            model: "Recipe",
                            select: "title category description preparation ingredients nutritions featureImage images previousVersions __v"
                        }
                    }
                    ],
                })
                .then(user => {
                    // Prosiriti da se admin i system isto ne racunaju
                    if ((user._id.toString() !== loginUser._id.toString()) || (loginUser.role !== 'admin') || (loginUser.role !== 'system')) {
                        const currentDate = new Date();
                        // Checking does user already have this user seen
                        const userView = user.views.users.find(user => user.userId._id.toString() == userId.toString());

                        if (userView) {
                            // If yes
                            if (userView.expiration <= currentDate) {
                                // If time is expired, increment cound and set new expiration
                                user.views.count += 1;
                                userView.expiration = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
                            }
                        } else {
                            // If user haven't seen this recipe before, add it
                            user.views.count += 1;
                            user.views.users.push({ userId: userId, expiration: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000) });
                        }
                        return user.save()
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });
                    }
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });


            // Filter recipes based on visibility and subscription status
            const filteredRecipes = user.userRecipes.reduce((filtered, recipe) => {

                // Always show public recipes
                if (recipe.recipeId.type === 'public') {
                    filtered.push(recipe);
                }
                // Show protected recipes only if the current user is subscribed to the author
                else if (recipe.recipeId.type === 'protected') {
                    if (recipe.recipeId.buyers.some(buyer => buyer.userId.toString() === loginUser._id.toString())) {
                        filtered.push(recipe);
                    } else {
                        filtered.push({
                            recipeId: {
                                _id: recipe.recipeId._id,
                                title: recipe.recipeId.title,
                                description: recipe.recipeId.description,
                                ratings: recipe.recipeId.ratings,
                                preparation: {
                                    duration: recipe.recipeId.preparation.duration
                                },
                                type: recipe.recipeId.type,
                                featureImage: "/images/locked.png",
                                category: recipe.recipeId.category,
                                cost: recipe.recipeId.cost,
                                cond: true
                            }
                        })
                    }
                }
                // Show private recipes only if the current user is subscribed to the author
                else if (recipe.recipeId.type === 'private') {
                    const res = user.subscribers.users.some(subscriber => subscriber.userId.toString() === loginUser._id.toString());
                    if (res) {
                        filtered.push(recipe);
                    } else {
                        filtered.push({
                            recipeId: {
                                _id: recipe.recipeId._id,
                                title: recipe.recipeId.title,
                                type: recipe.recipeId.type,
                                ratings: recipe.recipeId.ratings,
                                preparation: {
                                    duration: recipe.recipeId.preparation.duration
                                },
                                featureImage: "/images/locked.png",
                                category: recipe.recipeId.category,
                                cost: recipe.recipeId.cost,
                                cond: true
                            }
                        })
                    }
                } else {
                    filtered.push({
                        recipeId: {
                            _id: recipe.recipeId._id,
                            title: recipe.recipeId.title,
                            type: recipe.recipeId.type,
                            ratings: recipe.recipeId.ratings,
                            preparation: {
                                duration: recipe.recipeId.preparation.duration
                            },
                            featureImage: "/images/locked.png",
                            category: recipe.recipeId.category,
                            cost: recipe.recipeId.cost,
                            cond: true
                        }
                    })
                }
                return filtered;
            }, []);

            // Filter books based on visibility and subscription status
            const filteredBooks = user.userBooks.reduce((filtered, book) => {
                // Always show public book
                if (book.bookId.type === 'public') {
                    filtered.push(book);
                }
                // Show protected book only if the current user is subscribed to the author
                else if (book.bookId.type === 'protected') {
                    if (book.bookId.buyers.some(buyer => buyer.userId.toString() === loginUser._id.toString())) {
                        filtered.push(book);
                    } else {
                        filtered.push({
                            bookId: {
                                _id: book.bookId._id,
                                title: book.bookId.title,
                                description: book.bookId.description,
                                coverImage: "/images/locked.png",
                                type: book.bookId.type,
                                recipes: book.bookId.recipes.length,
                                cost: book.bookId.cost,
                                cond: true
                            }
                        })
                    }
                }
                // Show private books only if the current user is subscribed to the author
                else if (book.bookId.type === 'private') {
                    const res = user.subscribers.users.some(subscriber => subscriber.userId.toString() === loginUser._id.toString());
                    if (res) {
                        filtered.push(book);
                    } else {
                        filtered.push({
                            bookId: {
                                _id: book.bookId._id,
                                title: book.bookId.title,
                                description: book.bookId.description,
                                type: book.bookId.type,
                                recipes: book.bookId.recipes.length,
                                coverImage: "/images/locked.png",
                                cost: book.bookId.cost,
                                cond: true
                            }
                        })
                    }
                } else {
                    filtered.push({
                        bookId: {
                            _id: book.bookId._id,
                            title: book.bookId.title,
                            description: book.bookId.description,
                            type: book.bookId.type,
                            recipes: book.bookId.recipes.length,
                            coverImage: "/images/locked.png",
                            cost: book.bookId.cost,
                            cond: true
                        }
                    })
                }
                return filtered;
            }, []);
            // Render userProfile page and show the data
            return res.status(200).render('user/new-user-profile', {
                path: '/korisnik-profil',
                pageTitle: 'Profil Korisnika',
                pageDescription: "",
                pageKeyWords: "",
                user: {
                    _id: user._id,
                    username: user.username,
                    userImage: user.userImage,
                    role: user.role,
                    followers: user.followers,
                    following: user.following,
                    subscribers: user.subscribers,
                    userRecipes: filteredRecipes,
                    userBooks: filteredBooks,
                    subCost: user.subCost
                },
                wallet: +userWallet.wallet,
                loginUser: loginUser,
                isBlocked: false,
                isBlocking: false
            });
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    };
};

exports.getRecipeDetails = async (req, res, next) => {
    try {
        // Get current user
        const userId = req.session.user._id;

        const user = await User.findById(userId)
            .select("userBooks savedRecipes")
            .populate("userBooks.bookId", "_id title recipes")
            .populate("userBooks.bookId.recipes.recipeId", '_id title')
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });

        // Get _id from request.recipeId
        const recipeId = req.params.recipeId;

        const books = await Book.find({
            $and: [
                { buyers: { $elemMatch: { userId: userId } } },
                { recipes: { $elemMatch: { recipeId: recipeId } } }
            ]
        })
            .select("recipes buyers")
            .catch(err => {
                const error = new Error("Nije moguće pronaći Knjigu!");
                error.httpStatusCode = 404;
                return next(error);
            });

        // Fetch recipe data that is allowed to be seen
        await Recipe.findById(recipeId)
            .populate('author', "_id username userImage subscribers")
            .populate('ratings.userId', 'username userImage')
            .populate("buyers.userId", "_id username userImage")
            .populate({
                path: 'history.historyId',
                select: 'type date cost purchaseId',
                populate: {
                    path: 'purchaseId',
                    select: 'data'
                }
            })
            .then(recipe => {
                if (recipe.author._id.toString() !== userId.toString()) {
                    if (recipe.type === "private") {
                        let exist = recipe.author.subscribers.users.some(subscriber => subscriber.userId.toString() === userId.toString());
                        if (!exist) {
                            recipe = {
                                _id: recipe._id,
                                title: recipe.title,
                                author: recipe.author,
                                featureImage: "/images/locked.png",
                                cost: recipe.cost,
                                ratings: recipe.ratings,
                                cond: true,
                                cType: "sub"
                            }
                        }
                    }
                    if (recipe.type === "protected") {
                        let exist = recipe.buyers.some(buyer => buyer.userId._id.toString() === userId.toString());
                        let hasBoughtBook;

                        if (books.length > 0) {
                            books.forEach(book => {
                                hasBoughtBook = book.buyers.some(buyer => buyer.userId.toString() === userId.toString());
                            })
                        } else {
                            hasBoughtBook = false;
                        }

                        if (!exist && !hasBoughtBook) {
                            recipe = {
                                _id: recipe._id,
                                author: recipe.author,
                                title: recipe.title,
                                featureImage: "/images/locked.png",
                                cost: recipe.cost,
                                ratings: recipe.ratings,
                                cond: true,
                                cType: "buy"
                            }
                        }
                    }
                    return recipe
                } else {
                    return recipe
                }
            })
            .then(recipe => {
                if (!recipe.cond) {
                    if (recipe.author._id.toString() !== userId.toString()) {
                        const currentDate = new Date();

                        // Checking does user already have this recipe seen
                        const userView = recipe.views.users.find(user => user.userId._id.toString() == userId.toString());

                        if (userView) {
                            // If yes
                            if (userView.expiration <= currentDate) {
                                // If time is expired, increment cound and set new expiration
                                recipe.views.count += 1;
                                userView.expiration = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
                            }
                        } else {
                            // If user haven't seen this recipe before, add it
                            recipe.views.count += 1;
                            recipe.views.users.push({ userId: userId, expiration: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000) });
                        }

                        return recipe.save()
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Receptu!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });
                    }
                }
                return recipe;
            })
            .then(recipe => {
                // Render recipeDetails page and populate it with data
                return res.status(200).render("user/new-recipe-details", {
                    recipe: recipe,
                    path: "/recept-detalji",
                    pageTitle: "Recept Detalji",
                    pageDescription: "",
                    pageKeyWords: "",
                    user: user,
                })
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Recept!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška! ");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getBookDetails = (req, res, next) => {
    try {
        // Get current user
        const userId = req.session.user._id;

        // Get _id from request.bookId
        const bookId = req.params.bookId;

        // Fetch book data that is allowed to be seen
        Book.findById(bookId)
            .populate("author", "_id username userImage subscribers")
            .populate("recipes.recipeId", "_id title featureImage author")
            .populate("buyers.userId", "_id username userImage")
            .populate({
                path: 'history.historyId',
                select: 'type date cost purchaseId',
                populate: {
                    path: 'purchaseId',
                    select: 'data'
                }
            })
            .then(book => {
                if (book.author._id.toString() !== userId.toString()) {
                    if (book.type === "private") {
                        let exist = book.author.subscribers.users.some(subscriber => subscriber.userId.toString() === userId.toString());
                        if (!exist) {
                            book = {
                                _id: book._id,
                                author: book.author,
                                recipes: [],
                                coverImage: "/images/locked.png",
                                cond: true
                            }
                        }
                    } else if (book.type === "protected") {
                        let isBuyer = book.buyers.some(buyer => buyer.userId._id.toString() === userId.toString());
                        if (!isBuyer) {
                            book = {
                                _id: book._id,
                                author: book.author,
                                recipes: [],
                                coverImage: "/images/locked.png",
                                cond: true
                            }
                        }
                    }
                }
                return book
            })
            .then(book => {
                if (!book.cond) {
                    if ((book.author._id.toString() !== userId.toString()) && (req.session.user.role !== "admin") && (req.session.user.role !== "system")) {
                        const currentDate = new Date();

                        // Checking does user already have this book seen
                        const userView = book.views.users.find(user => user.userId._id.toString() === userId.toString());

                        if (userView) {
                            // If yes
                            if (userView.expiration <= currentDate) {
                                // If time is expired, increment cound and set new expiration
                                book.views.count += 1;
                                userView.expiration = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
                            }
                        } else {
                            // If user haven't seen this book before, add it
                            book.views.count += 1;
                            book.views.users.push({ userId: userId, expiration: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000) });
                        }

                        return book.save()
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Knjizi!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });
                    }
                }
                return book;
            })
            .then(book => {
                User.findById(userId)
                    .select("savedBooks")
                    .then(user => {
                        // Render bookDetails page and populate it with data
                        return res.status(200).render("user/new-book-details", {
                            path: "/knjiga-detalji",
                            pageTitle: "Knjiga Detalji",
                            pageDescription: "",
                            pageKeyWords: "",
                            book: book,
                            user: user
                        })
                    })
                    .catch(err => {
                        const error = new Error("Nije moguće pronaći Korisnika!");
                        error.httpStatusCode = 404;
                        return next(error);
                    });

            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Knjigu!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    };
};

exports.getAddRecipe = async (req, res, next) => {
    try {
        const user = req.session.user;

        // Check if there are existingData, if not set to []
        let existingData = req.existingData;
        if (existingData) {
            existingData = existingData;
        } else {
            existingData = null;
        };

        const filePath = path.join(__dirname, '../public/json', 'categories.json');
        let allCategories = await getAllCategories(filePath);
   
        // Render addRecipe Page
        return res.status(200).render("user/new-add-recipe", {
            path: "/dodajte-recept",
            pageTitle: "Recept Dodavanje",
            pageDescription: "",
            pageKeyWords: "",
            existingData: existingData,
            errorMessage: "",
            userRole: user.role,
            editing: false,
            categories: allCategories,
            isAdmin: false
        })
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAddBook = (req, res, next) => {
    try {
        const userRole = req.session.user.role;

        // Check if there are existingData, if not set to []
        let existingData = req.existingData;
        if (existingData) {
            existingData = existingData;
        } else {
            existingData = null;
        };

        // Render addBook Page
        return res.status(200).render("user/new-add-book", {
            path: "/dodajte-knjigu",
            pageTitle: "Knjiga Dodavanje",
            pageDescription: "",
            pageKeyWords: "",
            existingData: existingData,
            errorMessage: "",
            userRole: userRole,
            editing: false,
            isAdmin: false
        });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getEditRecipe = (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const recipeId = req.params.recipeId;

        User.findById(userId)
            .select("userRecipes")
            .then(user => {
                const hasRecipe = user.userRecipes.find(recipe => recipe.recipeId.toString() === recipeId.toString());
                if (hasRecipe) {
                    Recipe.findById(recipeId)
                        .then(recipe => {
                            // Check if there are existingData, if not set to []
                            let existingData = req.existingData;
                            if (existingData) {
                                existingData = existingData;
                            } else {
                                existingData = null;
                            };

                            const filePath = path.join(__dirname, '../public/json', 'categories.json');
   
                            let categories;
                            fs.readFile(filePath, 'utf-8', (err, data) => {
                                if (err) {
                                const error = new Error('Error reading JSON file:', err);
                                error.httpStatusCode = 500;
                                return next(error);
                                }

                                // Parsiraj JSON podatke
                                categories = JSON.parse(data);

                                // Render addRecipe Page
                                return res.status(200).render("user/new-add-recipe", {
                                    path: "/dodajte-recept",
                                    pageTitle: "Recept Izmena",
                                    pageDescription: "",
                                    pageKeyWords: "",
                                    existingData: existingData,
                                    errorMessage: "",
                                    userRole: user.role,
                                    editing: true,
                                    isAdmin: false,
                                    recipe: recipe,
                                    categories: categories
                                })
                            })
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće pronaći Recept!");
                            error.httpStatusCode = 404;
                            return next(error);
                        });
                } else {
                    return next(new Error("Vi nemate traženi recept!"))
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getEditBook = (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const bookId = req.params.bookId;

        User.findById(userId)
            .select("userBooks")
            .then(user => {
                const hasBook = user.userBooks.find(book => book.bookId.toString() === bookId.toString());
                if (hasBook) {
                    Book.findById(bookId)
                        .then(book => {
                            // Check if there are existingData, if not set to []
                            let existingData = req.existingData;
                            if (existingData) {
                                existingData = existingData;
                            } else {
                                existingData = null;
                            };

                            // Render addRecipe Page
                            return res.status(200).render("user/new-add-book", {
                                path: "/dodajte-knjigu",
                                pageTitle: "Knjiga Izmena",
                                pageDescription: "",
                                pageKeyWords: "",
                                existingData: existingData,
                                errorMessage: "",
                                userRole: user.role,
                                editing: true,
                                isAdmin: false,
                                book: book
                            })
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće pronaći Knjigu!");
                            error.httpStatusCode = 404;
                            return next(error);
                        });
                } else {
                    const error = new Error("Vi nemate traženu Knjigu!");
                    error.httpStatusCode = 404;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika! ");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getRecipesByCategory = (req, res, next) => {
    // Get recipes by category
    // Render data
    next();
}

exports.getHistoryDetails = (req, res, next) => {
    try {
        const loggedUserId = req.session.user._id;
        const historyId = req.params.historyId;

        if (req.query.purchase) {
            return User.findById(loggedUserId)
                .select("boughtRecipes boughtBooks")
                .then(user => {
                    let boughtRecipes = user.boughtRecipes.find(recipe => recipe.purchaseId.toString() === historyId.toString()) || false;
                    let boughtBooks = user.boughtBooks.find(book => book.purchaseId.toString() === historyId.toString()) || false;

                    if (boughtRecipes || boughtBooks) {
                        return History.findOne({ purchaseId: historyId })
                            .populate({
                                path: 'purchaseId',
                                select: 'data',
                                populate: [{
                                    path: 'data.author',
                                    model: 'User',
                                    select: 'username userImage'
                                },
                                {
                                    path: 'data.recipeId',
                                    model: 'Recipe',
                                    select: 'title description category preparation ingredients nutritions featureImage images previousVersions __v'
                                },
                                {
                                    path: 'data.bookId',
                                    model: 'Book',
                                    select: 'title description coverImage recipes previousVersions __v',
                                    populate: {
                                        path: 'recipes.recipeId',
                                        model: "Recipe",
                                        select: "title category description preparation ingredients nutritions featureImage images previousVersions __v"
                                    }
                                }]
                            })
                            .then(history => {
                                let haveNewVersion;

                                // Checking version of recipe
                                if (history.purchaseId.data.recipeId) {
                                    if (history.purchaseId.data.boughtVersion < history.purchaseId.data.recipeId.__v) {
                                        const checkVersion = history.purchaseId.data.boughtVersion < history.purchaseId.data.recipeId.__v;
                                        const checkTitle = history.purchaseId.data.title === history.purchaseId.data.recipeId.title;
                                        const checkDescription = history.purchaseId.data.description === history.purchaseId.data.recipeId.description;
                                        const checkCategory = history.purchaseId.data.category.toString() === history.purchaseId.data.recipeId.category.toString();
                                        const checkPreparationDuration = history.purchaseId.data.preparation.duration.toString() === history.purchaseId.data.recipeId.preparation.duration.toString();
                                        const checkPreparationNote = history.purchaseId.data.preparation.note.toString() === history.purchaseId.data.recipeId.preparation.note.toString();
                                        const checkPreparationSteps = history.purchaseId.data.preparation.steps.toString() === history.purchaseId.data.recipeId.preparation.steps.toString();
                                        const checkIngredients = JSON.stringify(history.purchaseId.data.ingredients) === JSON.stringify(history.purchaseId.data.recipeId.ingredients);
                                        const checkNutritions = JSON.stringify(history.purchaseId.data.nutritions) === JSON.stringify(history.purchaseId.data.recipeId.nutritions);
                                        const checkFeatureImage = history.purchaseId.data.featureImage === history.purchaseId.data.recipeId.featureImage;
                                        const checkImages = history.purchaseId.data.images.toString() === history.purchaseId.data.recipeId.images.toString();

                                        if (checkVersion && (!checkTitle || !checkDescription || !checkCategory || !checkPreparationDuration || !checkPreparationNote || !checkPreparationSteps || !checkIngredients || !checkNutritions || !checkFeatureImage || !checkImages)) {
                                            haveNewVersion = true;
                                        }
                                    }

                                // Checking version of book
                                // Izazov je sto kada se recept izmeni a nalazi se u nekoj knjizi ne dolazi do promene verzije
                                } else if (history.purchaseId.data.bookId) {
                                    if (history.purchaseId.data.boughtVersion < history.purchaseId.data.bookId.__v) {
                                        const checkVersion = history.purchaseId.data.boughtVersion < history.purchaseId.data.bookId.__v;
                                        const checkTitle = history.purchaseId.data.title === history.purchaseId.data.bookId.title;
                                        const checkDescription = history.purchaseId.data.description === history.purchaseId.data.bookId.description;
                                        const checkCoverImage = history.purchaseId.data.coverImage === history.purchaseId.data.bookId.coverImage;

                                        let checkRecipes;

                                        // Checking the number of recipes in book
                                        if (history.purchaseId.data.bookId.recipes.length !== history.purchaseId.data.recipes.length) {
                                            checkRecipes = false;
                                        } else {
                                            history.purchaseId.data.bookId.recipes.forEach((recipe, index) => {
                                                const cond2 = history.purchaseId.data.recipes[index].recipeId.title === recipe.recipeId.title;
                                                const cond3 = history.purchaseId.data.recipes[index].recipeId.description === recipe.recipeId.description;
                                                const cond4 = history.purchaseId.data.recipes[index].recipeId.featureImage === recipe.recipeId.featureImage;
                                                const cond5 = history.purchaseId.data.recipes[index].recipeId.__v === recipe.recipeId.__v;
                                                console.log(recipe.recipeId.__v)

                                                const cond6 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.category) === JSON.stringify(recipe.recipeId.category);

                                                const cond7 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.images) === JSON.stringify(recipe.recipeId.images);

                                                const cond8 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.ingredients) === JSON.stringify(recipe.recipeId.ingredients);

                                                const cond9 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.nutritions) === JSON.stringify(recipe.recipeId.nutritions);

                                                const cond10 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.preparation.note.toString()) === JSON.stringify(recipe.recipeId.preparation.note.toString());
                                                const cond11 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.preparation.duration.toString()) === JSON.stringify(recipe.recipeId.preparation.duration.toString());
                                                const cond12 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.preparation.steps.toString()) === JSON.stringify(recipe.recipeId.preparation.steps.toString());

                                                checkRecipes = cond2 && cond3 && cond4 && cond5 && cond6 && cond7 && cond8 && cond9 && cond10 && cond11 && cond12;
                                            })
                                        }

                                        if (!checkVersion || !checkTitle || !checkDescription || !checkCoverImage || !checkRecipes) {
                                            haveNewVersion = true;
                                        }
                                    } else {
                                        if (history.purchaseId.data.bookId.recipes.length !== history.purchaseId.data.recipes.length) {
                                            checkRecipes = false;
                                        } else {
                                            history.purchaseId.data.bookId.recipes.forEach((recipe, index) => {
                                                const cond2 = history.purchaseId.data.recipes[index].recipeId.title === recipe.recipeId.title;
                                                const cond3 = history.purchaseId.data.recipes[index].recipeId.description === recipe.recipeId.description;
                                                const cond4 = history.purchaseId.data.recipes[index].recipeId.featureImage === recipe.recipeId.featureImage;
                                                const cond5 = history.purchaseId.data.recipes[index].recipeId.__v === recipe.recipeId.__v;

                                                const cond6 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.category) === JSON.stringify(recipe.recipeId.category);

                                                const cond7 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.images) === JSON.stringify(recipe.recipeId.images);

                                                const cond8 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.ingredients) === JSON.stringify(recipe.recipeId.ingredients);

                                                const cond9 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.nutritions) === JSON.stringify(recipe.recipeId.nutritions);

                                                const cond10 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.preparation.note.toString()) === JSON.stringify(recipe.recipeId.preparation.note.toString());
                                                const cond11 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.preparation.duration.toString()) === JSON.stringify(recipe.recipeId.preparation.duration.toString());
                                                const cond12 = JSON.stringify(history.purchaseId.data.recipes[index].recipeId.preparation.steps.toString()) === JSON.stringify(recipe.recipeId.preparation.steps.toString());

                                                checkRecipes = cond2 && cond3 && cond4 && cond5 && cond6 && cond7 && cond8 && cond9 && cond10 && cond11 && cond12;
                                            })
                                        }

                                        if (!checkRecipes) {
                                            haveNewVersion = true;
                                        }
                                    }
                                }

                                return res.status(200).render("user/user-includes/new-history-details", {
                                    path: "/istorija-detalji",
                                    pageTitle: "Istorija Detalji",
                                    pageDescription: "",
                                    pageKeyWords: "",
                                    history: history,
                                    userRole: req.session.user.role,
                                    haveNewVersion: haveNewVersion
                                });
                            })
                            .catch(err => {
                                const error = new Error("Nije moguće pronaći Istoriju! " + err);
                                error.httpStatusCode = 500;
                                return next(error);
                            });
                    } else {
                        const error = new Error("Nije moguće pronaći Istoriju!");
                        error.httpStatusCode = 404;
                        return next(error);
                    }
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            return User.findById(loggedUserId)
                .select('history')
                .then(userHistory => {
                    const hasHistory = userHistory.history.find(history => history.historyId.toString() === historyId.toString());

                    if (hasHistory) {
                        return History.findById(historyId)
                            .populate({
                                path: 'purchaseId',
                                select: 'data',
                                populate: [{
                                    path: 'data.author',
                                    model: 'User',
                                    select: 'username userImage'
                                },
                                {
                                    path: 'data.userId',
                                    model: 'User',
                                    select: 'username userImage'
                                },
                                {
                                    path: 'data.recipeId',
                                    model: 'Recipe',
                                    select: 'title description category preparation ingredients nutritions featureImage images previousVersions __v'
                                },
                                {
                                    path: 'data.bookId',
                                    model: 'Book',
                                    select: 'title description coverImage recipes previousVersions __v',
                                    populate: {
                                        path: 'recipes.recipeId',
                                        model: "Recipe",
                                        select: "title category description preparation ingredients nutritions featureImage images previousVersions __v"
                                    }
                                }]
                            })
                            .then(history => {
                                let haveNewVersion;

                                if (history.purchaseId.data.recipeId) {
                                    if (history.purchaseId.data.boughtVersion < history.purchaseId.data.recipeId.__v) {
                                        const checkTitle = history.purchaseId.data.title === history.purchaseId.data.recipeId.title;
                                        const checkDescription = history.purchaseId.data.description === history.purchaseId.data.recipeId.description;
                                        const checkCategory = history.purchaseId.data.category.toString() === history.purchaseId.data.recipeId.category.toString();
                                        const checkPreparationDuration = history.purchaseId.data.preparation.duration.toString() === history.purchaseId.data.recipeId.preparation.duration.toString();
                                        const checkPreparationNote = history.purchaseId.data.preparation.note === history.purchaseId.data.recipeId.preparation.note;
                                        const checkPreparationSteps = history.purchaseId.data.preparation.steps.toString() === history.purchaseId.data.recipeId.preparation.steps.toString();
                                        const checkIngredients = JSON.stringify(history.purchaseId.data.ingredients) === JSON.stringify(history.purchaseId.data.recipeId.ingredients);
                                        const checkNutritions = JSON.stringify(history.purchaseId.data.nutritions) === JSON.stringify(history.purchaseId.data.recipeId.nutritions);
                                        const checkFeatureImage = history.purchaseId.data.featureImage === history.purchaseId.data.recipeId.featureImage;
                                        const checkImages = history.purchaseId.data.images.toString() === history.purchaseId.data.recipeId.images.toString();

                                        if (!checkTitle || !checkDescription || !checkCategory || !checkPreparationDuration || !checkPreparationNote || !checkPreparationSteps || !checkIngredients || !checkNutritions || !checkFeatureImage || !checkImages) {
                                            haveNewVersion = true;
                                        }
                                    }
                                } else if (history.purchaseId.data.bookId) {
                                    const checkVersion = history.purchaseId.data.boughtVersion < history.purchaseId.data.bookId.__v;
                                    const checkTitle = history.purchaseId.data.title === history.purchaseId.data.bookId.title;
                                    const checkDescription = history.purchaseId.data.description === history.purchaseId.data.bookId.description;
                                    const checkCoverImage = history.purchaseId.data.coverImage === history.purchaseId.data.bookId.coverImage;
                                    let checkRecipes;

                                    if (history.purchaseId.data.bookId.recipes.length !== history.purchaseId.data.recipes.length) {
                                        checkRecipes = false;
                                    } else {
                                        history.purchaseId.data.bookId.recipes.forEach(recipe => {
                                            history.purchaseId.data.recipes.forEach(otherRecipe => {
                                                const cond2 = otherRecipe.title === recipe.title;
                                                const cond3 = otherRecipe.description === recipe.description;
                                                const cond4 = otherRecipe.featureImage === recipe.featureImage;
                                                const cond5 = otherRecipe.__v === recipe.__v;

                                                const cond6 = JSON.stringify(otherRecipe.category) === JSON.stringify(recipe.category);

                                                const cond7 = JSON.stringify(otherRecipe.images) === JSON.stringify(recipe.images);

                                                const cond8 = JSON.stringify(otherRecipe.ingredients) === JSON.stringify(recipe.ingredients);

                                                const cond9 = JSON.stringify(otherRecipe.nutritions) === JSON.stringify(recipe.nutritions);

                                                const cond10 = JSON.stringify(otherRecipe.preparation) === JSON.stringify(recipe.preparation);

                                                checkRecipes = cond2 && cond3 && cond4 && cond5 && cond6 && cond7 && cond8 && cond9 && cond10;
                                            })
                                        })
                                    }

                                    if (checkVersion && (!checkTitle || !checkDescription || !checkCoverImage || !checkRecipes)) {
                                        haveNewVersion = true;
                                    }

                                } else if (history.type === "requestedWithdrawal") {
                                    const decryptedAESKey = decryptAESKey(history.purchaseId.data.aesKey, privateKey);

                                    const decryptedFirstname = decryptData(history.purchaseId.data.firstname, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));
                                    const decryptedLastname = decryptData(history.purchaseId.data.lastname, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));
                                    const decryptedAccountNumber = decryptData(history.purchaseId.data.accountNumber, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));

                                    return res.status(200).render("user/user-includes/new-history-details", {
                                        path: "/istorija-detalji",
                                        pageTitle: "Istorija Detalji",
                                        pageDescription: "",
                                        pageKeyWords: "",
                                        history: {
                                            _id: history._id,
                                            type: history.type,
                                            date: history.date,
                                            cost: history.cost,
                                            purchaseId: {
                                                _id: history.purchaseId._id,
                                                data: {
                                                    userId: history.purchaseId.data.userId,
                                                    username: history.purchaseId.data.username,
                                                    userImage: history.purchaseId.data.userImage,
                                                    title: history.purchaseId.data.title,
                                                    firstname: decryptedFirstname,
                                                    lastname: decryptedLastname,
                                                    accountNumber: decryptedAccountNumber
                                                }
                                            }
                                        },
                                        userRole: req.session.user.role,
                                        haveNewVersion: haveNewVersion
                                    });
                                }
                                return res.status(200).render("user/user-includes/new-history-details", {
                                    path: "/istorija-detalji",
                                    pageTitle: "Istorija Detalji",
                                    pageDescription: "",
                                    pageKeyWords: "",
                                    history: history,
                                    userRole: req.session.user.role,
                                    haveNewVersion: haveNewVersion
                                });
                            })
                            .catch(err => {
                                const error = new Error("Nije moguće pronaći istoriju!");
                                error.httpStatusCode = 404;
                                return next(error);
                            });
                    } else {
                        const error = new Error("Nije moguće pronaći istoriju!");
                        error.httpStatusCode = 404;
                        return next(error);
                    }
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getNewWithdrawal = (req, res, next) => {
    try {
        const withdrawalToken = req.params.withdrawalToken;
        const isSystem = req.query.isSystem ? req.query.isSystem : false;

        User.findOne({ withdrawalToken: withdrawalToken, withdrawalTokenExpiration: { $gt: Date.now() } })
            .select('_id wallet status role')
            .then(user => {
                let existingData = req.existingData;
                if (existingData) {
                    existingData = existingData;
                } else {
                    existingData = null;
                };

                const isSuspended = user.status.find(status => status === 'suspended');
                let min = isSuspended ? user.wallet : 1000;
                if (isSystem) {
                    return res.status(200).render("transactions/new-withdrawal", {
                        path: "/new-withdrawal",
                        pageTitle: "Nova Isplata",
                        pageDescription: "",
                        pageKeyWords: "",
                        errorMessage: "",
                        existingData: "",
                        userId: user._id,
                        userRole: user.role,
                        withdrawalToken: withdrawalToken,
                        wallet: user.wallet,
                        min: min,
                        isSystem: true
                    });
                } else {
                    return res.status(200).render("transactions/new-withdrawal", {
                        path: "/new-withdrawal",
                        pageTitle: "Nova Isplata",
                        pageDescription: "",
                        pageKeyWords: "",
                        errorMessage: "",
                        existingData: "",
                        userId: user._id,
                        userRole: user.role,
                        withdrawalToken: withdrawalToken,
                        wallet: user.wallet,
                        min: min,
                        isSystem: false
                    });
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getEmailSent = (req, res, next) => {
    try {
        return res.status(200).render("transactions/email-sent", {
            path: "/poslat-email",
            pageTitle: "Poslat Email!",
            pageDescription: "",
            pageKeyWords: "",
            title: "",
            text: ""
        });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}
// ---------------------------------  POST Functions -------------------------------------------------------------


exports.postEditSubCost = (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).redirect("/moj-profil");
        };

        const userId = req.body.userId;
        const subCost = req.body.newSubCost;
        const loggedUser = req.session.user._id;

        if (userId.toString() === loggedUser.toString()) {
            User.findById(userId)
                .select("subCost")
                .then(user => {
                    user.subCost = subCost;
                    return user.save()
                        .then(() => {
                            return res.status(422).redirect("/moj-profil");
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            const error = new Error("Vi nemate dozvolu da to uradite!");
            error.httpStatusCode = 403;
            return next(error);
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAddRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const filePath = path.join(__dirname, '../public/json', 'categories.json');
        let allCategories = await getAllCategories(filePath);

        // Get current logged-in user
        const author = req.session.user._id;
        const userRole = req.session.user.role;

        // Get data from request.body
        const title = req.body.title;
        const categories = Array.isArray(req.body["category"]) ? req.body["category"] : [req.body["category"]];
        const description = req.body.description;
        const newIngredients = Array.isArray(req.body["ingredients"]) ? req.body["ingredients"] : [req.body["ingredients"]];
        const newIngredientsAmount = Array.isArray(req.body["ingredientsAmount"]) ? req.body["ingredientsAmount"] : [req.body["ingredientsAmount"]];
        const duration = req.body.duration;
        const steps = Array.isArray(req.body["steps"]) ? req.body["steps"] : [req.body["steps"]];
        const note = req.body.note;
        const newNutritionsName = Array.isArray(req.body["nutritions"]) ? req.body["nutritions"] : req.body["nutritions"] ? [req.body["nutritions"]] : [];
        const newNutritionsAmount = Array.isArray(req.body["nutritionsAmount"]) ? req.body["nutritionsAmount"] : req.body["nutritionsAmount"] ? [req.body["nutritionsAmount"]] : [];

        const ingredients = newIngredients.map((ingredient, index) => ({
            name: ingredient,
            amount: newIngredientsAmount[index],
        }));
        const nutritions = newNutritionsName.length > 0 ? newNutritionsName.map((nutrition, index) => ({
            name: nutrition,
            amount: newNutritionsAmount[index],
        })) : [];

        const type = req.body.type;
        const cost = req.body.cost;
        const featureImage = req.files.find(file => file.fieldname === 'images' && !Array.isArray(file));
        const uploadedImages = req.files.filter(file => file.fieldname === 'images');
        uploadedImages.splice(0, 1);

        // Data validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render("user/new-add-recipe", {
                path: "/dodajte-recept",
                pageTitle: "Novi Recept",
                errorMessage: errors.array()[0].msg,
                pageDescription: "",
                pageKeyWords: "",
                existingData: { // Populate form with existing data
                    title: title,
                    category: categories,
                    description: description,
                    preparation: {
                        duration: duration,
                        steps: steps,
                        note: note
                    },
                    ingredients: ingredients,
                    nutritions: nutritions,
                    type: type,
                    cost: cost,
                    images: uploadedImages ? uploadedImages : [],
                },
                userRole: userRole,
                categories: allCategories,
                editing: false,
                isAdmin: false
            });
        }

        // Check if user has permission to create the recipe
        if (type === "protected" && userRole === "user") {
            return res.status(422).render("user/new-add-recipe", {
                path: "/dodajte-recept",
                pageTitle: "Novi Recept",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: "Nemate dozvolu da napravite to!",
                existingData: { // Populate form with existing data
                    title: title,
                    category: categories,
                    description: description,
                    preparation: {
                        duration: duration,
                        steps: steps,
                        note: note
                    },
                    ingredients: ingredients,
                    nutritions: nutritions,
                    type: type,
                    cost: cost,
                    images: uploadedImages ? uploadedImages : [],
                },
                userRole: userRole,
                categories: allCategories,
                editing: false,
                isAdmin: false
            });
        }

        // Process feature image and uploaded images
        let featureImageUrl, result;
        if (featureImage) {
            featureImageUrl = "/images/" + featureImage.filename;
        } else {
            featureImageUrl = "/images/default_recipe.png";
        }
        

        let images = [];
        if (uploadedImages && uploadedImages.length > 0) {
            for (const image of uploadedImages) {
                let path = "/images/" + image.filename;
                images.push(path);
            }
        }

        // Create new Recipe model and populate it with data
        const recipe = new Recipe({
            title: title,
            category: categories,
            author: author,
            description: description,
            featureImage: featureImageUrl,
            images: images,
            preparation: {
                duration: duration,
                note: note,
                steps: steps,
            },
            ingredients: ingredients,
            nutritions: nutritions,
            ratings: [],
            views: {
                count: 0,
                users: []
            },
            saves: {
                count: 0,
                users: []
            },
            type: type,
            cost: cost,
            buyers: [],
            history: [],
            createdAt: Date.now()
        });

        // Save new Recipe to database
        await recipe.save({ session });

        // Add recipe to current user in userRecipes
        await User.findOneAndUpdate(
            { _id: author },
            { $push: { userRecipes: { recipeId: recipe._id } } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(201).redirect("/moj-profil");
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error("Nije moguće sačuvati Recept! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAddBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Get current logged-in user
        const author = req.session.user._id;
        const userRole = req.session.user.role;

        // Get data from request.body
        const title = req.body.title;
        const description = req.body.description;
        const coverImage = req.files.find(file => file.fieldname === 'images' && !Array.isArray(file));
        
        const type = req.body.type;
        const cost = req.body.cost;

        // Data validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render("user/new-add-book", {
                path: "/dodajte-knjigu",
                pageTitle: "Nova Knjiga",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: errors.array()[0].msg,
                existingData: {
                    title: title,
                    description: description,
                },
                userRole: userRole
            });
        }

        if (type === "protected" && userRole === "user") {
            return res.status(422).render("user/new-add-book", {
                path: "/dodajte-knjigu",
                pageTitle: "Nova Knjiga",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: "Vi nemate dozvolu da to napravite!",
                existingData: {
                    title: title,
                    description: description,
                },
                userRole: userRole
            });
        }

        let coverImageUrl;
        if (coverImage) {
            coverImageUrl = "/images/" + coverImage.filename;
        } else {
            coverImageUrl = "/images/default_book.png";
        }        

        // Create new Book model and populate it with data
        const book = new Book({
            title: title,
            author: author,
            description: description,
            coverImage: coverImageUrl,
            recipes: [],
            views: {
                count: 0,
                users: []
            },
            saves: {
                count: 0,
                users: []
            },
            type: type,
            cost: cost,
            buyers: [],
            history: [],
            createdAt: Date.now()
        });

        // Save new Book to database
        await book.save({ session });

        // Add that book to current user in userBooks
        await User.findOneAndUpdate(
            { _id: author },
            { $push: { userBooks: { bookId: book._id } } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        // Render myProfile page
        return res.status(201).redirect('/moj-profil');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error("Nije moguće sačuvati Knjigu!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAddRecipeToBook = (req, res, next) => {
    try {
        const recipeId = req.body.recipeId;
        const bookId = req.body.bookSelect;

        Book.findById(bookId)
            .select("recipes __v")
            .then(book => {
                const recipeExist = book.recipes.find(recipe => recipe.recipeId.toString() === recipeId.toString());
                if (!recipeExist) {
                    book.recipes.push({ recipeId: recipeId });
                    book.__v += 1;
                    return book.save()
                        .then(book => {
                            return res.status(201).redirect('/recept-detalji/' + recipeId);
                        })
                        .catch(err => {
                            const error = new Error("Nije mougće sačuvati promene na Knjizi!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Ovaj Recept je već u Knjizi!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Knjigu!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postEditRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.session.user._id;
        const userRole = req.session.user.role;
        const recipeId = req.body.recipeId;

        // Get data from request.body
        const title = req.body.title;
        const categories = Array.isArray(req.body["category"]) ? req.body["category"] : [req.body["category"]];
        const description = req.body.description;
        const newIngredients = Array.isArray(req.body["ingredients"]) ? req.body["ingredients"] : [req.body["ingredients"]];
        const newIngredientsAmount = Array.isArray(req.body["ingredientsAmount"]) ? req.body["ingredientsAmount"] : [req.body["ingredientsAmount"]];
        const duration = req.body.duration;
        const steps = Array.isArray(req.body["steps"]) ? req.body["steps"] : [req.body["steps"]];
        const note = req.body.note;
        const newNutritionsName = Array.isArray(req.body["nutritions"]) ? req.body["nutritions"] : req.body["nutritions"] ? [req.body["nutritions"]] : [];
        const newNutritionsAmount = Array.isArray(req.body["nutritionsAmount"]) ? req.body["nutritionsAmount"] : req.body["nutritionsAmount"] ? [req.body["nutritionsAmount"]] : [];
        const type = req.body.type;
        const cost = req.body.cost;

        const featureImage = req.files.find(file => file.fieldname === 'images' && !Array.isArray(file));
        const uploadedImages = req.files.filter(file => file.fieldname === 'images');
        uploadedImages.splice(0, 1);

        const ingredients = newIngredients.map((ingredient, index) => ({
            name: ingredient,
            amount: newIngredientsAmount[index],
        }));

        const nutritions = newNutritionsName.length > 0 ? newNutritionsName.map((nutrition, index) => ({
            name: nutrition,
            amount: newNutritionsAmount[index],
        })) : [];

        const filePath = path.join(__dirname, '../public/json', 'categories.json');
        let allCategories = await getAllCategories(filePath);

        // Data validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render("user/new-add-recipe", {
                path: "/dodajte-recept",
                pageTitle: "Recept Izmena",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: errors.array()[0].msg,
                existingData: {
                    title: title || ' ',
                    category: categories || [],
                    description: description || ' ',
                    preparation: {
                        duration: duration || ' ',
                        steps: steps || [],
                        note: note || ' '
                    },
                    ingredients: ingredients || { name: ' ', amount: ' ' },
                    nutritions: nutritions || { name: ' ', amount: ' ' },
                    images: uploadedImages || [],
                    type: type || ' ',
                    cost: cost || ' '
                },
                recipe: new mongoose.Types.ObjectId(recipeId),
                userRole: userRole,
                editing: true,
                isAdmin: false,
                categories: allCategories
            });
        }

        // Find the recipe by id
        const oldRecipe = await Recipe.findById(recipeId).session(session);
        if (!oldRecipe) {
            throw new Error("Nije moguće pronaći Recept!");
        }

        // Check if the user has permission to edit the recipe
        if (oldRecipe.author.toString() !== userId.toString()) {
            return res.status(403).send("Vi nemate dozvolu da izmenite ovaj Recept!");
        }

        // Check if user has permission to create the recipe
        if (type === "protected" && userRole === "user") {
            return res.status(422).render("user/new-add-recipe", {
                path: "/dodajte-recept",
                pageTitle: "Recept Izmena",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: "Vi nemate dozvolu da napravite to!",
                existingData: {
                    title: title || ' ',
                    category: categories || [],
                    description: description || ' ',
                    preparation: {
                        duration: duration || ' ',
                        steps: steps || [],
                        note: note || ' '
                    },
                    ingredients: ingredients || { name: ' ', amount: ' ' },
                    nutritions: nutritions || { name: ' ', amount: ' ' },
                    images: uploadedImages || [],
                    type: type || ' ',
                    cost: cost || ' '
                },
                userRole: userRole,
                recipe: new mongoose.Types.ObjectId(recipeId),
                editing: true,
                isAdmin: false,
                categires: allCategories
            });
        }

        // Update the recipe with new data
        oldRecipe.title = title;
        oldRecipe.category = categories;
        oldRecipe.description = description;
        oldRecipe.preparation.duration = duration;
        oldRecipe.preparation.steps = steps;
        oldRecipe.preparation.note = note;
        oldRecipe.ingredients = ingredients;
        oldRecipe.nutritions = nutritions;
        oldRecipe.cost = cost;

        // Process feature image
        if (featureImage) {
            const oldFeatureImage = oldRecipe.featureImage.replace('/images/','');
            deleteImage(oldFeatureImage, oldRecipe.type ===  'public');
            oldRecipe.featureImage = '/images/' + featureImage.filename;
        }

        // Process additional uploaded images
        if (uploadedImages.length > 0) {
            const oldImages = oldRecipe.images.map(image => {
                return image.replace('/images/',"");
            });
            deleteImage(oldImages);
            const uploadedImagePaths = uploadedImages.map(image => image.filename);
            oldRecipe.images = uploadedImagePaths.map(id => '/images/' + id);
        }

        oldRecipe.type = type;

        // Save the updated recipe to the database
        await oldRecipe.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.redirect("/recept-detalji/" + recipeId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error("Nije moguće sačuvati promene na Receptu!");
        error.httpStatusCode = 500;
        return next(error);
    }
};


exports.postEditBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.session.user._id;
        const userRole = req.session.user.role;
        const bookId = req.body.bookId;

        const oldBook = await Book.findById(bookId)
            .select("title description author coverImage type cost")
            .session(session);

        if (!oldBook) {
            throw new Error("Nije moguće pronaći Knjigu!");
        }

        if (oldBook.author.toString() !== userId.toString()) {
            const error = new Error("Vi nemate dozvolu da izmenite ovu Knjigu!");
            error.httpStatusCode = 403;
            throw error;
        }
                // Data validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render("user/new-add-book", {
                path: "/dodajte-knjigu",
                pageTitle: "Knjiga Izmena",
                pageDescription: "",
                pageKeyWords: "",
                errorMessage: errors.array()[0].msg,
                existingData: {
                    title: req.body.title,
                    description: req.body.description,
                    type: req.body.type,
                    cost: req.body.cost
                },
                userRole: userRole,
                editing: true,
                book: oldBook
            });
        }

        oldBook.title = req.body.title;
        oldBook.description = req.body.description;
        oldBook.cost = req.body.cost;

        const coverImage = req.files.find(file => file.fieldname === 'images' && !Array.isArray(file));
        if (coverImage) {
            const oldCoverImage = oldBook.coverImage.replace('/images/','');
            deleteImage(oldCoverImage, oldBook.type ===  'public');

            const coverImageUrl = coverImage.path.replace(/\\/g, '');
            const result = await uploadImage(coverImage.path);
            coverImageUrl = result.secure_url;
            oldBook.coverImage = coverImageUrl;
        }   

        oldBook.type = req.body.type;

        await oldBook.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).redirect("/knjiga-detalji/" + bookId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Nije moguće sačuvati promene na Knjizi!");
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postEditUserImage = (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).redirect("/moj-profil");
        };

        const userId = req.body.userId;
        const userImage = req.files.find(file => file.fieldname === 'images' && !Array.isArray(file));
        const userImageUrl = userImage.filename;
        const loggedUser = req.session.user._id;

        if (userId.toString() === loggedUser.toString()) {
            User.findById(userId)
                .select("userImage")
                .then(user => {
                    if (user.userImage.toString() != '/images/default-user.png') {
                        const oldUserImage = user.userImage.replace("/images/", "");
                        deleteImage(oldUserImage);
                    }
                    
                    user.userImage = "/images/" + userImageUrl;
                    return user.save()
                        .then(() => {
                            return res.status(201).redirect("/moj-profil");
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            const error = new Error("Vi nemate dozvolu da izmenite!");
            error.httpStatusCode = 403;
            return next(error);
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postSaveRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const recipeId = req.body.recipeId;
        const userId = req.session.user._id;

        // Find the recipe and update it
        const recipe = await Recipe.findById(recipeId).session(session);
        if (!recipe) {
            throw new Error("Nije moguće pronaći Recept!");
        }
        recipe.saves.count += 1;
        recipe.saves.users.push({ userId });

        // Find the user and update it
        const user = await User.findById(userId).select("savedRecipes").session(session);
        if (!user) {
            throw new Error("Nije moguće pronaći Korisnika!");
        }
        user.savedRecipes.push({ recipeId: recipeId });

        // Save both documents within the transaction
        await recipe.save({ session });
        await user.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).redirect('/recept-detalji/' + recipeId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Desila se neočekivana greška prilikom čuvanja Recepta!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postSaveBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bookId = req.body.bookId;
        const userId = req.session.user._id;

        // Find the book and update it
        const book = await Book.findById(bookId).session(session);
        if (!book) {
            throw new Error("Nije moguće pronaći Knjigu!");
        }
        book.saves.count += 1;
        book.saves.users.push({ userId });

        // Find the user and update it
        const user = await User.findById(userId).select("savedBooks").session(session);
        if (!user) {
            throw new Error("Nije moguće pronaći Korisnika!");
        }
        user.savedBooks.push({ bookId: bookId });

        // Save both documents within the transaction
        await book.save({ session });
        await user.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).redirect('/knjiga-detalji/' + bookId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Desila se neočekivana greška prilikom čuvanja Knjige!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postRateRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const recipeId = req.body.recipeId;
        const userId = req.body.userId;
        const rate = req.body.rate;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const error = new Error(errors.array()[0].msg);
            error.httpStatusCode = 422;
            return next(error);
        }

        // Find the recipe and check conditions
        const recipe = await Recipe.findById(recipeId).select("_id author ratings").session(session);
        if (!recipe) {
            throw new Error("Nije moguće pronaći Recept!");
        }

        if (recipe.author.toString() === userId.toString()) {
            const error = new Error("Nije moguće oceniti vlastiti Recept!");
            error.httpStatusCode = 409;
            return next(error);
        }

        const hasRated = recipe.ratings.find(rate => rate.userId.toString() === userId.toString());
        if (hasRated) {
            const error = new Error("Već ste ocenili ovaj Recept!");
            error.httpStatusCode = 409;
            return next(error);
        }

        // Add rating and save the recipe
        recipe.ratings.push({ stars: Number(rate), userId: userId });
        await recipe.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).redirect('/recept-detalji/' + recipeId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Desila se neočekivana greška prilikom čuvanja Recepta!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postBuyRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const recipeId = req.body.recipeId;
        const loggedUser = await User.findById(req.session.user._id).select("username wallet history boughtRecipes").session(session);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new Error(errors.array()[0].msg);
        }

        const recipe = await Recipe.findById(recipeId).select('title description featureImage images category cost author preparation ingredients nutritions buyers history').session(session);
        
        if (!recipe) {
            throw new Error("Nije moguće pronaći Recept!");
        }

        if (loggedUser.wallet < recipe.cost) {
            throw new Error("Nemate dovoljno novca da kupite ovaj Recept!");
        }

        // Deduct cost from user's wallet
        loggedUser.wallet -= recipe.cost;

        // Create purchase record for author and recipe
        const purchaseForRecipe = new Purchase({
            data: {
                userId: loggedUser._id,
                username: loggedUser.username,
                dataId: new mongoose.Types.ObjectId(recipeId),
                title: recipe.title
            }
        });
        await purchaseForRecipe.save({ session });

        // Add buyer to recipe
        recipe.buyers.push({ userId: loggedUser._id });

        // Create and save history for recipe
        const historyForRecipe = new History({
            type: "recipeBoughtBy",
            date: Date.now(),
            cost: recipe.cost,
            purchaseId: purchaseForRecipe._id
        });

        await historyForRecipe.save({ session });

        recipe.history.push({ historyId: historyForRecipe._id });
        await recipe.save({ session });

        // Update author's wallet
        const author = await User.findById(recipe.author).select('wallet email history').session(session);
        
        if (!author) {
            throw new Error("Nije moguće pronaći Autora!");
        }

        author.wallet += recipe.cost;
        author.history.push({ historyId: historyForRecipe._id });

        await author.save({ session });

        // Create and save purchase record for user
        const purchaseForUser = new Purchase({
            data: {
                recipeId: recipe._id,
                author: author._id,
                title: recipe.title,
                category: recipe.category,
                description: recipe.description,
                featureImage: recipe.featureImage,
                images: recipe.images,
                preparation: {
                    duration: recipe.preparation.duration,
                    steps: recipe.preparation.steps,
                    note: recipe.preparation.note
                },
                ingredients: recipe.ingredients,
                nutritions: recipe.nutritions,
                cost: recipe.cost,
                boughtVersion: recipe.__v,
                previousVersions: []
            }
        });
        await purchaseForUser.save({ session });

        // Add purchase to user's history
        loggedUser.boughtRecipes.push({ purchaseId: purchaseForUser._id });
        const historyForUser = new History({
            type: "recipeBuy",
            date: Date.now(),
            cost: recipe.cost,
            purchaseId: purchaseForUser._id
        });
        await historyForUser.save({ session });

        loggedUser.history.push({ historyId: historyForUser._id });
        await loggedUser.save({ session });

        let userMailOptions = {
            from: "Kuvajmo Zajedno",
            to: loggedUser.email,
            subject: "Uspešna kupovina Recepta: " + recipe.title,
            text: "Uspešna kupovina Recepta " + recipe.title,
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Uspešna Kupovina</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                
                        <h1 style="color: #009688; margin-bottom: 20px;">Upravo ste kupili novi Recept!</h1>
                
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${loggedUser.username},</p>
                
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Uspešno kupljen Recept: ${recipe.title}</p>
    
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">ID Istorije: ${historyForUser._id}</p
    
                    </div>
                
                </body>
                </html>
                `,
            };

        transporter.sendMail(userMailOptions, function (error, info) {
            if (error) {
                res.status(200);
            } else {
                res.status(500);
            }
        });

        // Send email to author
        const mailOptions = {
            from: "Kuvajmo Zajedno",
            to: author.email,
            subject: "Recept kupljen od strane: " + loggedUser.username,
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Vaš Recept je upravo kupljen!</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #009688; margin-bottom: 20px;">Vaš Recept je prodan!</h1>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${author.username},</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Prodaliste recept: '${recipe.title}' korisniku ${loggedUser.username}</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">ID Istorije: ${historyForRecipe._id}</p>
                    </div>
                </body>
                </html>`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email not sent: ', error);
            } else {
                console.log('Email sent: ', info.response);
            }
        });

        await session.commitTransaction();
        session.endSession();

        res.status(201).redirect('/recept-detalji/' + recipe._id);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Desila se neočekivana greška prilikom kupovine Recepta!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postBuyBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bookId = req.body.bookId;
        const loggedUserId = req.session.user._id;
        let recipes = [];

        const book = await Book.findById(bookId)
            .select("title description coverImage author history cost buyers recipes __v")
            .populate("author.userId", "_id username userImage")
            .populate("recipes.recipeId", "_id title category description featureImage images ingredients preparation nutritions author __v")
            .session(session)

        const loggedUser = await User.findById(loggedUserId)
            .select("username email boughtBooks history wallet")
            .session(session)

        if (loggedUser.wallet >= book.cost) {
            const purchaseForBook = new Purchase({
                data: {
                    userId: loggedUser._id,
                    username: loggedUser.username,
                    dataId: book._id,
                    title: book.title
                }
            });

            book.recipes.forEach(recipe => {
                recipes.push({
                    recipeId: {
                        _id: recipe.recipeId._id,
                        title: recipe.recipeId.title,
                        description: recipe.recipeId.description,
                        category: recipe.recipeId.category,
                        featureImage: recipe.recipeId.featureImage,
                        images: recipe.recipeId.images,
                        ingredients: recipe.recipeId.ingredients,
                        nutritions: recipe.recipeId.nutritions,
                        preparation: {
                            duration: recipe.recipeId.preparation.duration,
                            note: recipe.recipeId.preparation.note,
                            steps: recipe.recipeId.preparation.steps
                        },
                        __v: recipe.recipeId.__v
                    }
                });
            });

            await purchaseForBook.save({ session });

            const history = new History({
                type: "bookBoughtBy",
                date: Date.now(),
                cost: book.cost,
                userId: loggedUser._id,
                purchaseId: purchaseForBook._id
            });

            await history.save({ session });

            book.buyers.push({ userId: loggedUser._id });
            book.history.push({ historyId: history._id });

            const author = await User.findById(book.author._id)
                .select('username email history wallet')
                .session(session)

            author.history.push({ historyId: history._id });
            author.wallet += book.cost;

            await author.save({ session });

            let mailOptions = {
                from: "Kuvajmo Zajedno",
                to: author.email,
                subject: "Knjiga kupljena od strane: " + loggedUser.username,
                text: loggedUser.username + " je kupio knjigu: " + book.title,
                html: `
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Nova Prodaja Knjige!</title>
                    </head>
                    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    
                        <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                    
                            <h1 style="color: #009688; margin-bottom: 20px;">Vaša Knjiga je upravo prodana!</h1>
                    
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${author.username},</p>
                    
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Vašu Knjigu: '${book.title}' je kupio ${loggedUser.username}</p>
        
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">ID Istorije: ${history._id}</p>
            
                        </div>
                    
                    </body>
                    </html>
                    `,
                };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    res.status(200);
                } else {
                    res.status(500);
                }
            });

            const purchaseForUser = new Purchase({
                data: {
                    bookId: book._id,
                    title: book.title,
                    description: book.description,
                    coverImage: book.coverImage,
                    author: book.author,
                    recipes: recipes,
                    boughtVersion: book.__v,
                    previousVersions: []
                }
            });

            loggedUser.wallet -= book.cost;

            await purchaseForUser.save({ session });

            loggedUser.boughtBooks.push({ purchaseId: purchaseForUser._id });

            const userHistory = new History({
                type: "bookBuy",
                date: Date.now(),
                cost: book.cost,
                userId: loggedUser._id,
                purchaseId: purchaseForUser._id
            });

            await userHistory.save({ session });

            loggedUser.history.push({ historyId: userHistory._id });

            let userMailOptions = {
                from: "Kuvajmo Zajedno",
                to: loggedUser.email,
                subject: "Uspešna kupovina Knjige: " + book.title,
                text: "Uspešna kupovina Knjige " + book.title,
                html: `
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Uspešna Kupovina</title>
                    </head>
                    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    
                        <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                    
                            <h1 style="color: #009688; margin-bottom: 20px;">Upravo ste kupili novu Knjigu!</h1>
                    
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${loggedUser.username},</p>
                    
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Uspešna kupovina knjige: ${book.title}</p>
        
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">ID Istorije: ${userHistory._id}</p
        
                        </div>
                    
                    </body>
                    </html>
                    `,
                };

            transporter.sendMail(userMailOptions, function (error, info) {
                if (error) {
                    res.status(200);
                } else {
                    res.status(500);
                }
            });

            await loggedUser.save({ session });
            await book.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).redirect('/knjiga-detalji/' + book._id);

        } else {
            const error = new Error("Nemate dovoljno novca da kupite ovu Knjigu!");
            error.httpStatusCode = 409;
            throw error;
        }
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postDeleteMyRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Check if current user is the author
        const userId = req.session.user._id;
        const recipeId = req.body.recipeId;

        const recipe = await Recipe.findById(recipeId).select('author').session(session);
        if (!recipe) {
            throw new Error('Nije moguće pronaći Recept!');
        }

        if (recipe.author.toString() !== userId.toString()) {
            throw new Error("Vi nemate dozvolu da uradite to!");
        }

        // Proceed to delete recipe
        const recipeBuyers = await Recipe.findById(recipeId).select('buyers').session(session);
        if (!recipeBuyers) {
            throw new Error('Nije moguće pronaći Recept!');
        }

        if (recipeBuyers.buyers.length < 1) {
            let imagePaths = [];
            const recipeToDelete = await Recipe.findById(recipeId).select('type featureImage images').session(session);
            if (!recipeToDelete) {
                const error = new Error('Nije moguće pronaći Recept!');
                error.httpStatusCode = 404;
                return next(error);
            }

            imagePaths.push(recipeToDelete.featureImage);
            imagePaths.push(...recipeToDelete.images);

            for (const imgPath of imagePaths) {
                if (imgPath.startsWith('/images/uploads/')) {
                    const publicId = imgPath.replace('/images/', "");
                    deleteImage(publicId, recipeToDelete.type === 'public')
                }
            }
        }

        // Delete the recipe from all users' savedRecipes
        await User.updateMany(
            { "savedRecipes.recipeId": recipeId },
            { $pull: { "savedRecipes": { "recipeId": recipeId } } }
        ).session(session);

        // Delete the recipe from the current user's userRecipes
        await User.updateOne(
            { "userRecipes.recipeId": recipeId },
            { $pull: { "userRecipes": { "recipeId": recipeId } } }
        ).session(session);

        // Delete the recipe from all books that contain it
        await Book.updateMany(
            { "recipes.recipeId": recipeId },
            { $pull: { "recipes": { "recipeId": recipeId } } }
        ).session(session);

        // Delete the recipe from the database
        await Recipe.deleteOne({ "_id": recipeId }).session(session);

        await session.commitTransaction();
        session.endSession();

        // Redirect to myProfile and render data
        return res.status(204).redirect('/moj-profil');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error(err.message || 'Desila se neočekivana greška!');
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postDeleteMyBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Check if the current user is the author
        const userId = req.session.user._id;
        const bookId = req.body.bookId;

        const book = await Book.findById(bookId).select('author type coverImage').session(session);
        if (!book) {
            throw new Error('Nije mougće pronaći Knjigu!');
        }

        if (book.author.toString() !== userId.toString()) {
            throw new Error("Vi nemate dozvolu da uradite to!");
        }

        // Proceed to delete book
        const bookBuyers = await Book.findById(bookId).select('buyers').session(session);
        if (!bookBuyers) {
            throw new Error('Nije mougće pronaći Knjigu!');
        }

        if (bookBuyers.buyers.length < 1) {
            const bookToDelete = book;

            if (bookToDelete.coverImage !== '/images/default_book.png') {
                const coverImagePath = bookToDelete.coverImage;

                if (coverImagePath.startsWith('/images/uploads/')) {
                    const publicId = coverImagePath.replace('/images/', "");
                    deleteImage(publicId, bookToDelete.type === 'public')
                }
            }
        }

        // Delete the book from all users' savedBooks
        await User.updateMany(
            { "savedBooks.bookId": bookId },
            { $pull: { "savedBooks": { "bookId": bookId } } }
        ).session(session);

        // Delete the book from the current user's userBooks
        await User.updateOne(
            { "userBooks.bookId": bookId },
            { $pull: { "userBooks": { "bookId": bookId } } }
        ).session(session);

        // Delete the book from the database
        await Book.deleteOne({ "_id": bookId }).session(session);

        await session.commitTransaction();
        session.endSession();

        // Redirect to myProfile and render data
        return res.status(204).redirect('/moj-profil');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error(err.message || 'Desila se neočekivana greška!');
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postDeleteSavedRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Get _id from request.recipeId
        const recipeId = req.body.recipeId;
        const userId = req.session.user._id;

        // Find the current recipe and remove the user from saves and decrease count
        const recipe = await Recipe.findById(recipeId).session(session);
        if (!recipe) {
            throw new Error("Nije moguće pronaći Recept!");
        }

        recipe.saves.count -= 1;
        recipe.saves.users.remove({ userId });

        await recipe.save({ session });

        // Find the current user and remove the recipe from savedRecipes
        const user = await User.findById(userId).select("savedRecipes").session(session);
        if (!user) {
            throw new Error("Nije moguće pronaći Korisnika!");
        }

        const recipeExist = user.savedRecipes.find(recipe => recipe.recipeId.toString() === recipeId.toString());
        if (!recipeExist) {
            throw new Error("Traženi Recept se ne nalazi u Vašim sačuvanim Receptima!");
        }

        user.savedRecipes.remove({ recipeId: recipeId });

        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Redirect to recipe-details and render data
        return res.status(204).redirect('/recept-detalji/' + recipeId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error(err.message || 'Desila se neočekivana greška!');
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postDeleteSavedBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const bookId = req.body.bookId;
        const userId = req.session.user._id;

        // Find the current book and remove the user from saves and decrease count
        const book = await Book.findById(bookId).session(session);
        if (!book) {
            throw new Error("Nije mougće pronaći Knjigu!");
        }

        book.saves.count -= 1;
        book.saves.users.remove({ userId });

        await book.save({ session });

        // Find the current user and remove the book from savedBooks
        const user = await User.findById(userId).select("savedBooks").session(session);
        if (!user) {
            throw new Error("Nije moguće pronaći Korisnika!");
        }

        const bookExist = user.savedBooks.find(book => book.bookId.toString() === bookId.toString());
        if (!bookExist) {
            throw new Error("Tražena Knjiga se ne nalazi u Vašim sačuvanim Knjigama!");
        }

        user.savedBooks.remove({ bookId: bookId });

        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Redirect to book-details and render data
        return res.status(201).redirect('/knjiga-detalji/' + bookId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error(err.message || 'Desila se neočekivana greška!');
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postDeleteRecipeFromBook = (req, res, next) => {
    try {
        // Delte recipe from book
        const recipeId = req.body.recipeId;
        const bookId = req.body.bookSelect || req.query.bookId;
        const loggedUser = req.session.user;
        const fromBook = req.query.fromBook;
        Book.findById(bookId)
            .select("recipes author __v")
            .then(book => {
                if ((book.author.toString() !== loggedUser._id.toString()) && (loggedUser.role !== 'admin') && (loggedUser.role !== 'system')) {
                    const error = new Error("Vi nemate dozvolu da uradite to!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
                const recipeExist = book.recipes.find(recipe => recipe.recipeId.toString() === recipeId.toString());
                if (recipeExist) {
                    book.recipes.remove({ recipeId: recipeId });
                    book.__v -= 1;
                    return book.save()
                        .then(() => {
                            if (fromBook && bookId) {
                                return res.status(204).redirect('/knjiga-detalji/' + bookId);
                            } else {
                                return res.status(204).redirect('/recept-detalji/' + recipeId);
                            }
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Knjizi!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Traženi Recept se ne nalazi u Knjizi!");
                    error.httpStatusCode = 404;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije mougće pronaći Knjigu!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postFollowUser = async (req, res, next) => {
    try {
        // Check if current user is equal with userId
        const userId = req.body.userId;
        const loggedUser = req.session.user._id;

        // If not check if user alredy exist in following
        await User.findById(loggedUser)
            .select("following")
            .then(lUser => {
                const isFollowing = lUser.following.users.find(follower => follower.userId._id.toString() === userId.toString());

                if (!isFollowing) {
                    lUser.following.count += 1;
                    lUser.following.users.push({ userId: userId })
                    return lUser.save()
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Vi već pratite ovog Korisnika!");
                    error.httpStatusCode = 500;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });

        User.findById(userId)
            .select("followers")
            .then(user => {
                const isFollower = user.followers.users.find(follower => follower.userId._id.toString() === loggedUser.toString());

                if (!isFollower) {
                    user.followers.count += 1;
                    user.followers.users.push({ userId: loggedUser })
                    return user.save()
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Ovaj Korisnik vas već ima kao pratioca!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .then(() => {
                return res.status(200).redirect("/korisnik-profil/" + userId);
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
    // If not in following increment count and add user in users
};

exports.postUnfollowUser = async (req, res, next) => {
    try {
        // Check if current user is equal with userId
        const userId = req.body.userId;
        const loggedUser = req.session.user._id;

        // If not check if user alredy exist in following
        await User.findById(loggedUser)
            .select("following")
            .then(lUser => {
                const isFollowing = lUser.following.users.find(follower => follower.userId._id.toString() === userId.toString());

                if (isFollowing) {
                    lUser.following.count -= 1;
                    lUser.following.users.remove({ userId: userId })
                    return lUser.save()
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Vi ne pratite ovog Korisnika!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });


        User.findById(userId)
            .select("followers")
            .then(user => {
                const isFollower = user.followers.users.find(follower => follower.userId._id.toString() === loggedUser.toString());

                if (isFollower) {
                    user.followers.count -= 1;
                    user.followers.users.remove({ userId: loggedUser })
                    return user.save()
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Ovaj Korisnik vas nema kao pratioca!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .then(() => {
                return res.status(201).redirect("/korisnik-profil/" + userId);
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
    // If not in following increment count and add user in users
};

exports.postSubscribeToUser = async (req, res, next) => {
    try {
        const userId = req.body.userId;
        const loggedUser = req.session.user._id;

        const loggedUserWallet = await User.findById(loggedUser)
            .select("wallet")
            .then(user => {
                return user.wallet;
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            })

        const userIdCost = await User.findById(userId)
            .select("subCost")
            .then(user => {
                return user.subCost;
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            })

        if (loggedUserWallet >= userIdCost) {
            purchaseForUser = new Purchase({
                data: {
                    userId: loggedUser,
                    username: req.session.user.username,
                    title: "subscription"
                }
            })

            // User that I subscribed to
            const updatedUser = await User.findById(userId)
                .select("username email userImage subscribers history subCost wallet")
                .then(user => {
                    userExist = user.subscribers.users.find(sUser => sUser.userId._id.toString() === loggedUser.toString());

                    if (!userExist) {
                        const today = new Date;
                        const expirationDate = new Date(today);
                        expirationDate.setDate(today.getDate() + 30);
                        user.subscribers.count += 1;
                        user.subscribers.users.push({ userId: loggedUser, expirationDate: expirationDate });
                        user.wallet += userIdCost;

                        purchaseForUser.save()
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Akciji!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });

                        historyForUser = new History({
                            type: "subscriptionFrom",
                            date: Date.now(),
                            cost: user.subCost,
                            userId: loggedUser,
                            purchaseId: purchaseForUser._id
                        })

                        historyForUser.save()
                            .then(history => {
                                user.history.push({ historyId: history._id })
                                return user.save()
                                    .catch(err => {
                                        const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                                        error.httpStatusCode = 500;
                                        return next(error);
                                    });
                            })
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Istroiji! ");
                                error.httpStatusCode = 500;
                                return next(error);
                            });

                        return user;
                    } else {
                        const error = new Error("Vi ste već pretplaćeni na ovog Korisnika!");
                        error.httpStatusCode = 500;
                        return next(error);
                    }
                })
                .then(user => {
                    let mailOptions = {
                        from: "Kuvajmo Zajedno",
                        to: user.email,
                        subject: "pretplata od strane: " + req.session.user.username,
                        text: "Uspešna pretplata od strane: " + req.session.user.username,
                        html: `
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Nova pretplata!</title>
                    </head>
                    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    
                        <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                    
                            <h1 style="color: #009688; margin-bottom: 20px;">Dobiliste novog pretplatinka!</h1>
                    
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                    
                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Korisnik: ${req.session.user.username} se upravo pretplatio na Vas!</p>
    
                        </div>
                    
                    </body>
                    </html>
                    `,
                    };

                    //Send email
                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            res.status(200);
                        } else {
                            res.status(500);
                        }
                    });
                    return user;
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });

            if (updatedUser) {
                const purchaseForLoggedUser = new Purchase({
                    data: {
                        userId: updatedUser._id,
                        username: updatedUser.username,
                        title: 'subscription'
                    }
                })

                // Logged User
                await User.findById(loggedUser)
                    .select("subscribed history wallet")
                    .then(user => {
                        purchaseForLoggedUser.save()
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });

                        const today = new Date;
                        const expirationDate = new Date(today);
                        expirationDate.setDate(today.getDate() + 30);
                        user.subscribed.count += 1;
                        user.subscribed.users.push({ userId: userId, expirationDate: expirationDate });
                        user.wallet -= userIdCost;

                        history = new History({
                            type: "subscriptionTo",
                            date: Date.now(),
                            cost: updatedUser.subCost,
                            userId: updatedUser._id,
                            purchaseId: purchaseForLoggedUser._id,
                            title: "subscription"
                        });

                        history.save()
                            .then(history => {
                                user.history.push({ historyId: history._id })
                                return user.save()
                                    .catch(err => {
                                        const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                                        error.httpStatusCode = 500;
                                        return next(error);
                                    });
                            })
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Istroiji!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });

                    })
                    .then(() => {
                        return res.status(201).redirect("/korisnik-profil/" + userId);
                    })
                    .catch(err => {
                        const error = new Error("Nije moguće pronaći Korisnika!");
                        error.httpStatusCode = 404;
                        return next(error);
                    });
            } else {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            }
        } else {
            const error = new Error("Nemate dovoljno novca da se pretplatite na ovog Korisnika!");
            error.httpStatusCode = 409;
            return next(error);
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    };
}

exports.postUnsubscribeFromUser = async (req, res, next) => {
    try {
        const userId = req.body.userId;
        const loggedUser = req.session.user._id;

        const updatedUser = await User.findById(userId)
            .select("subscribers")
            .then(user => {
                userExist = user.subscribers.users.find(sUser => sUser.userId._id.toString() === loggedUser.toString());
                if (userExist) {
                    user.subscribers.count -= 1;
                    user.subscribers.users.remove({ userId: loggedUser });
                    return user.save()
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Ovaj Korisnik vas nema kao pretplaćenog!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });

        if (updatedUser) {
            await User.findById(loggedUser)
                .select("subscribed")
                .then(user => {
                    const userExist = user.subscribed.users.find(sub => sub.userId._id.toString() === userId.toString());
                    if (userExist) {
                        user.subscribed.count -= 1;
                        user.subscribed.users.remove({ userId: userId })
                        return user.save()
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                                error.httpStatusCode = 500;
                                return next(error);
                            });
                    } else {
                        const error = new Error("You aren't subscribed to this user!");
                        error.httpStatusCode = 409;
                        return next(error);
                    }
                })
                .then(() => {
                    return res.status(201).redirect("/korisnik-profil/" + userId);
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Korisnika!");
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            const error = new Error("Nije moguće pronaći Korisnika!");
            error.httpStatusCode = 404;
            return next(error);
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postBlockUser = async (req, res, next) => {
    try {
        const userId = req.body.userId;
        const loginUser = req.session.user._id;

        await User.findById(userId)
            .select("blockedBy following followers subscribed subscribers")
            .populate('savedRecipes.recipeId', 'author')
            .populate('savedBooks.bookId', 'author')
            .then(user => {
                user.blockedBy.push({ userId: loginUser });
                const isFollowing = user.following.users.find(follower => follower.userId.toString() === loginUser.toString());
                if (isFollowing) {
                    user.following.users.pull({ userId: loginUser });
                }

                const isFollower = user.followers.users.find(follower => follower.userId.toString() === loginUser.toString());
                if (isFollower) {
                    user.followers.users.pull({ userId: loginUser });
                }

                const isSubscribed = user.subscribed.users.find(subscriber => subscriber.userId.toString() === loginUser.toString());
                if (isSubscribed) {
                    user.subscribed.users.pull({ userId: loginUser });
                }

                const isSubscriber = user.subscribers.users.find(subscriber => subscriber.userId.toString() === loginUser.toString());
                if (isSubscriber) {
                    user.subscribers.users.pull({ userId: loginUser });
                }

                const isSavedRecipe = user.savedRecipes.find(recipe => recipe.recipeId.author.toString() === loginUser.toString());
                if (isSavedRecipe) {
                    user.savedRecipes.pull({ author: loginUser })
                }

                const isSavedBook = user.savedBooks.find(book => book.bookId.author.toString() === loginUser.toString());
                if (isSavedBook) {
                    user.savedBooks.pull({ author: loginUser })
                }

                user.save()
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                        error.httpStatusCode = 500;
                        return next(error);
                    });
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });

        await User.findById(loginUser)
            .select('blocking following followers subscribed subscribers')
            .populate('savedRecipes.recipeId', 'author')
            .populate('savedBooks.bookId', 'author')
            .then(user => {
                user.blocking.push({ userId: userId });
                const isFollowing = user.following.users.find(follower => follower.userId.toString() === userId.toString());
                if (isFollowing) {
                    user.following.count -= 1;
                    user.following.users.pull({ userId: userId });
                }

                const isFollower = user.followers.users.find(follower => follower.userId.toString() === userId.toString());
                if (isFollower) {
                    user.followers.count -= 1;
                    user.followers.users.pull({ userId: userId });
                }

                const isSubscribed = user.subscribed.users.find(subscriber => subscriber.userId.toString() === userId.toString());
                if (isSubscribed) {
                    user.subscribed.count -= 1;
                    user.subscribed.users.pull({ userId: userId });
                }

                const isSubscriber = user.subscribers.users.find(subscriber => subscriber.userId.toString() === userId.toString());
                if (isSubscriber) {
                    user.subscribers.count -= 1;
                    user.subscribers.users.pull({ userId: userId });
                }

                const isSavedRecipe = user.savedRecipes.find(recipe => recipe.recipeId.author.toString() === userId.toString());
                if (isSavedRecipe) {
                    user.savedRecipes.pull({ author: userId })
                }

                const isSavedBook = user.savedBooks.find(book => book.bookId.author.toString() === userId.toString());
                if (isSavedBook) {
                    user.savedBooks.pull({ author: userId })
                }

                user.save()
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                        error.httpStatusCode = 500;
                        return next(error);
                    });
            })
            .then(() => {
                return res.status(201).redirect("/korisnik-profil/" + userId);
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postUnblockUser = async (req, res, next) => {
    try {
        const userId = req.body.userId;
        const loginUser = req.session.user._id;

        await User.findById(userId)
            .select("blockedBy")
            .then(user => {
                user.blockedBy.pull({ userId: loginUser })
                user.save()
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                        error.httpStatusCode = 500;
                        return next(error);
                    });
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });

        await User.findById(loginUser)
            .select('blocking')
            .then(user => {
                user.blocking.pull({ userId: userId });
                user.save()
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati promene na Korisniku!");
                        error.httpStatusCode = 500;
                        return next(error);
                    });
            })
            .then(() => {
                return res.status(201).redirect("/korisnik-profil/" + userId);
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postRequestDeposit = (req, res, next) => {
    try {
        const userId = req.session.user._id;

        User.findById(userId)
            .select("status email username")
            .then(user => {
                const isRequested = user.status.find(status => status === "requestedDeposit")

                if (!isRequested) {
                    user.status.push("requestedDeposit");
                    user.depositRequestExpiration = Date.now() + 24 * 60 * 60 * 1000;
                    user.save()
                        .then(() => {
                            let mailOptions = {
                                from: "Kuvajmo Zajedno",
                                to: user.email,
                                subject: "Zatražen Depozit",
                                text: "Zatražen Depozit",
                                html: `
                            <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Zatražen Depozit!</title>
                            </head>
                            <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                            
                                <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                            
                                    <h1 style="color: #009688; margin-bottom: 20px;">Zatražiliste Depozit!!</h1>
                            
                                    <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                            
                                    <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                    Molimo vas da izvrišite uplatu praćenjem sledećih instrukcija:
                                    </p>
                                    
                                    <div style="text-align: left; margin: 0 auto; padding-left: 20px;">
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Uplaćuje: <strong>Vaše Ime i Prezime</strong>
                                        </p>
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Svrha Uplate: <strong>depozit</strong>
                                        </p>
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Primalac: <strong>Milan Vasovic</strong>
                                        </p>
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Valuta: <strong>rsd</strong>
                                        </p>
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Iznos: <strong>željeni iznos</strong>
                                        </p>
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Račun Primaoca: <strong>265000000577319369</strong>
                                        </p>
                                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                        Poziv na broj: <strong>${user.username}</strong>
                                        </p>
                                    </div>
                                    
                                    <img src="cid:nalog-za-uplatu" alt="nalog-za-uplatu" style="max-width: 560px">

                                    <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                    Molimo Vas da pre uplate pročitate: <strong>Uslove Korišćenja</strong> i <strong>Politiku Privatnosti</strong> koje ste prihvatili.
                                    </p>
                                    <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                    Nakon uplate, Vaša uplata će biti registrovana u sistemu u roku od: <strong>24</strong> do <strong>72 sata</strong>.
                                    </p>
                                    <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                    Hvala Vam na razumevanju i strpljenju.
                                    </p>
                                    <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
                                    Za sve informacije i pitanja, možete poslati kroz našu podršku na web aplikaciji.   
                                    </p>
                                    
                                </div>
                            
                            </body>
                            </html>
                            `,
                                attachments: [{
                                    filename: 'nalog-za-uplatu.jpg',
                                    path: path.join(__dirname, '../images/nalog-za-uplatu.jpg'),
                                    cid: 'nalog-za-uplatu'
                                }]
                            };

                            //Send email
                            transporter.sendMail(mailOptions, function (err, info) {
                                if (err) {
                                    const error = new Error("Nije moguće poslati Email!");
                                    error.httpStatusCode = 500;
                                    return next(error);
                                } else {
                                    res.status(201);
                                }
                            });
                        })
                        .then(() => {
                            return res.status(201).render("transactions/email-sent", {
                                path: "/poslat-email",
                                pageTitle: "Poslat Email!",
                                pageDescription: "",
                                pageKeyWords: "",
                                title: "Zatražen Depozit",
                                text: "Poslat Vam je email sa instrukcijama, molimo Vas da ih pratite i proverite spam folder!"
                            });
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na Korisniku! ");
                            error.httpStatusCode = 500;
                            return next(error);
                        });
                } else {
                    const error = new Error("Vi ste već zatražili depozit molimo vas da budete strpljivi!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika! ");
                error.httpStatusCode = 404;
                return next(error);
            });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postRequestWithdrawal = (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const isSystem = req.body.isSystem ? req.body.isSystem : false;

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const error = new Error("Polja moraju biti ispravno popunjena! " + errors.array()[0].msg);
            error.httpStatusCode = 422;
            return next(error);
        }

        User.findById(userId)
            .select("email status")
            .then(user => {
                const isRequested = user.status.find(status => status === "requestedWithdrawal");

                if (!isRequested) {
                    user.status.push("requestedWithdrawal");

                    crypto.randomBytes(32, (err, buffer) => {

                        if (err) {
                            const error = new Error("Nije moguće generisati token! ");
                            error.httpStatusCode = 500;
                            return next(error);
                        }

                        const withdrawalToken = buffer.toString('hex');

                        user.withdrawalToken = withdrawalToken;
                        user.withdrawalTokenExpiration = Date.now() + 3600000;

                        user.save()
                            .then(() => {
                                let mailOptions;
                                if (isSystem) {
                                    mailOptions = {
                                        from: "Kuvajmo Zajedno",
                                        to: user.email,
                                        subject: "Zatražena Isplata",
                                        text: "Zatražena Isplata",
                                        html: `
                                    <html lang="en">
                                    <head>
                                        <meta charset="UTF-8">
                                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        <title>Zatražena Isplata!</title>
                                    </head>
                                    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                                    
                                        <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                                    
                                            <h1 style="color: #009688; margin-bottom: 20px;">Instrukcije za Isplatu!</h1>
                                    
                                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${req.session.user.username},</p>
                                    
                                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Kliknite na link ispod da nastavite sa procesom isplate.</p>
            
                                            <a href="https://www.kuvajmozajedno.com/zatrazite-isplatu/${withdrawalToken}?isSystem=true" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Nastavite Sa Isplatom</a>
                    
                                        </div>
                                    
                                    </body>
                                    </html>
                                    `,
                                    };
                                } else {
                                    mailOptions = {
                                        from: "Kuvajmo Zajedno",
                                        to: user.email,
                                        subject: "Zatražena Isplata",
                                        text: "Zatražena Isplata",
                                        html: `
                                    <html lang="en">
                                    <head>
                                        <meta charset="UTF-8">
                                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        <title>Zatražena Isplata!</title>
                                    </head>
                                    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                                    
                                        <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                                    
                                            <h1 style="color: #009688; margin-bottom: 20px;">Instrukcije za Isplatu!</h1>
                                    
                                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${req.session.user.username},</p>
                                    
                                            <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Kliknite na link ispod da nastavite sa procesom isplate.</p>
            
                                            <a href="https://www.kuvajmozajedno.com/zatrazite-isplatu/${withdrawalToken}" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Nastavite Sa Isplatom</a>
                    
                                        </div>
                                    
                                    </body>
                                    </html>
                                    `,
                                    };
                                }

                                //Send email
                                transporter.sendMail(mailOptions, function (error, info) {
                                    if (error) {
                                        const error = new Error("Neuspešno slanje emaila! ");
                                        error.httpStatusCode = 500;
                                        return next(error);
                                    } else {
                                        res.status(201);
                                    }
                                });

                                return res.status(201).render("transactions/email-sent", {
                                    path: "/poslat-email",
                                    pageTitle: "Email je Poslat!",
                                    pageDescription: "",
                                    pageKeyWords: "",
                                    title: "Zatražena Isplata",
                                    text: "Poslat Vam je email sa instrukcijam, molimo Vas da ih ispratite i proverite spam folder!"
                                });
                            })
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene!");
                                error.httpStatusCode = 500;
                                return next(error);
                            })
                    })
                } else {
                    const error = new Error("Vaš zahtev za isplatu je već podnet! Molimo Vas da proverite vaš email.");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći korisnika sa tim ID!");
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postNewWithdrawal = (req, res, next) => {
    try {
        const withdrawalToken = req.body.withdrawalToken;
        const firstname = req.body.firstname;
        const lastname = req.body.lastname;
        const accountNumber = req.body.accountNumber;
        const amount = req.body.amount;
        const userId = req.body.userId;
        const isSystem = req.body.isSystem ? req.body.isSystem : false;

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).render("transactions/new-withdrawal", {
                path: "/new-withdrawal",
                pageTitle: "Nova Isplata",
                pageDescription: "",
                pageKeyWords: "",
                withdrawalToken: withdrawalToken,
                userId: userId,
                errorMessage: errors.array()[0].msg,
                existingData: {
                    firstname: firstname,
                    lastname: lastname,
                    accountNumber: accountNumber
                }
            });
        }

        // Generisanje AES ključa i IV
        const { key, iv } = generateKeyAndIV();

        // Šifrovanje podataka
        const encryptedFirstname = encryptData(firstname, key, iv);
        const encryptedLastname = encryptData(lastname, key, iv);
        const encryptedAccountNumber = encryptData(accountNumber, key, iv);

        // Šifrovanje AES ključa
        const encryptedAESKey = encryptAESKey(key, publicKey);

        User.findOne({
            withdrawalToken: withdrawalToken,
            withdrawalTokenExpiration: { $gt: Date.now() },
            _id: userId,
        })
            .select("username userImage history withdrawalToken withdrawalTokenExpiration status wallet")
            .then(user => {
                if (user.wallet < amount) {
                    return res.status(422).render("transactions/new-withdrawal", {
                        path: "/new-withdrawal",
                        pageTitle: "Nova Isplata",
                        pageDescription: "",
                        pageKeyWords: "",
                        withdrawalToken: withdrawalToken,
                        userId: user._id,
                        errorMessage: "You don't have that amount!",
                        existingData: {
                            firstname: firstname,
                            lastname: lastname,
                            accountNumber: accountNumber,
                            amount: amount
                        },
                        wallet: user.wallet
                    });
                }
                user.withdrawalToken = undefined;
                user.withdrawalTokenExpiration = undefined;
                let newStatus = user.status.filter(elem => elem != "requestedWithdrawal");
                user.status = newStatus;

                let newPurchase;

                if (isSystem) {
                    newPurchase = new Purchase({
                        data: {
                            userId: user._id,
                            username: user.username,
                            userImage: user.userImage,
                            title: "withdrawal",
                            firstname: encryptedFirstname,
                            lastname: encryptedLastname,
                            accountNumber: encryptedAccountNumber,
                            aesKey: encryptedAESKey,
                            iv: iv.toString('hex'),
                            isSystem: true
                        }
                    })
                } else {
                    newPurchase = new Purchase({
                        data: {
                            userId: user._id,
                            username: user.username,
                            userImage: user.userImage,
                            title: "withdrawal",
                            firstname: encryptedFirstname,
                            lastname: encryptedLastname,
                            accountNumber: encryptedAccountNumber,
                            aesKey: encryptedAESKey,
                            iv: iv.toString('hex')
                        }
                    })
                }

                newPurchase.save()
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati novu akciju! ");
                        error.httpStatusCode = 500;
                        return next(error);
                    });

                const newHistory = new History({
                    type: "requestedWithdrawal",
                    date: Date.now(),
                    cost: amount,
                    purchaseId: newPurchase._id
                })

                newHistory.save()
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati istoriju! ");
                        error.httpStatusCode = 500;
                        return next(error);
                    });

                user.history.push({ historyId: newHistory._id });
                user.wallet -= amount;
                user.status.push("requestedWithdrawal");

                user.save()
                    .then(() => {
                        return res.status(201).render("transactions/email-sent", {
                            path: "/poslat-email",
                            pageTitle: "Uspešno!",
                            pageDescription: "",
                            pageKeyWords: "",
                            title: "Zahtev za isplatu je uspešno kreiran",
                            text: "Vaš zahtev je uspešno kreiran. Biće obrađen u roku 24h do 72h. Molimo Vas da budete strpljivi!"
                        });
                    })
                    .catch(err => {
                        const error = new Error("Nije moguće sačuvati promene na korisniku! ");
                        error.httpStatusCode = 500;
                        return next(error);
                    });
            })
            .catch(err => {
                return res.status(422).render("transactions/new-withdrawal", {
                    path: "/new-withdrawal",
                    pageTitle: "Nova Isplata",
                    pageDescription: "",
                    pageKeyWords: "",
                    withdrawalToken: withdrawalToken,
                    userId: req.body.userId,
                    errorMessage: "Nije moguće pronaći traženog korisnika! ",
                    existingData: {
                        firstname: firstname,
                        lastname: lastname,
                        accountNumber: accountNumber
                    }
                });
            })
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postRequestCreator = (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
        User.findById(userId)
            .select('role status')
            .then(user => {
                if (user.role.toString() === 'user') {
                    isRequested = user.status.find(status => status === "requestedCreator");

                    if(!isRequested) {
                        user.status.push("requestedCreator");
                        user.save()
                            .then(() => {
                                return res.status(201).redirect('/moj-profil');
                            })
                            .catch(err => {
                                const error = new Error("Nije moguće sačuvati promene na Korisniku! ");
                                error.httpStatusCode = 500;
                                return next(error);
                            })
                    } else {
                        const error = new Error("Vi ste već zatražili da postanete Kreator, molimo Vas da budete strpljivi!");
                        error.httpStatusCode = 422;
                        return next(error);
                    }
                } else {
                    const error = new Error("Vi ste već kreator ili imate ulogu iznad nje!");
                    error.httpStatusCode = 409;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika! ");
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Nije moguće pronaći Korisnika! ");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postRequestDeactivation = (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
        User.findById(userId)
            .select('status')
            .then(user => {
                isRequested = user.status.find(status => status === "requestedDeactivation");

                if(!isRequested) {
                    user.status.push("requestedDeactivation");
                    user.save()
                        .then(() => {
                            return res.status(201).redirect('/moj-profil');
                        })
                        .catch(err => {
                            const error = new Error("Nije moguće sačuvati promene na korisniku!");
                            error.httpStatusCode = 500;
                            return next(error);
                        })
                } else {
                    const error = new Error("Vaš zahtev za deaktivaciju naloga je već poslat! Molimo Vas da budete strpljivi!");
                    error.httpStatusCode = 422;
                    return next(error);
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Korisnika!");
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Nije moguće pronaći Korisnika! ");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postGetNewPurchaseVersion = async (req, res, next) => {
    try {
        const purchaseId = req.body.purchaseId;

        let toPrevious;
        // Proveriti validnost forme

        const purchase = await Purchase.findById(purchaseId)
            .then(purchase => {
                if (purchase.data.recipeId) {
                    toPrevious = {
                        title: purchase.data.previousVersions.length + 1,
                        recipe: {
                            title: purchase.data.title,
                            category: purchase.data.category,
                            description: purchase.data.description,
                            featureImage: purchase.data.featureImage,
                            images: purchase.data.images,
                            preparation: purchase.data.preparation,
                            ingredients: purchase.data.ingredients,
                            nutritions: purchase.data.nutritions
                        }
                    }

                    purchase.data.previousVersions.push(toPrevious);
                    return purchase;
                } else if (purchase.data.bookId) {
                    toPrevious = {
                        title: purchase.data.previousVersions.length + 1,
                        book: {
                            title: purchase.data.title,
                            description: purchase.data.description,
                            coverImage: purchase.data.coverImage,
                            recipes: purchase.data.recipes
                        }
                    }

                    purchase.data.previousVersions.push(toPrevious);
                    return purchase;
                }
            })
            .catch(err => {
                const error = new Error("Nije moguće pronaći Akciju! ");
                error.httpStatusCode = 404;
                return next(error);
            })

        if (purchase.data.recipeId) {
            const recipe = await Recipe.findById(purchase.data.recipeId)
                .select("title category description featureImage images preparation ingredients nutritions author __v")
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Recept!");
                    error.httpStatusCode = 404;
                    return next(error);
                })

            let newPurchaseData = new Purchase({
                _id: purchase._id,
                data: {
                    recipeId: recipe._id,
                    title: recipe.title,
                    category: recipe.category,
                    description: recipe.description,
                    featureImage: recipe.featureImage,
                    images: recipe.images,
                    preparation: recipe.preparation,
                    ingredients: recipe.ingredients,
                    nutritions: recipe.nutritions,
                    author: recipe.author,
                    boughtVersion: recipe.__v,
                    previousVersions: purchase.data.previousVersions,
                },
                __v: purchase.__v + 1
            })

            return Purchase.updateOne({ _id: purchase._id }, newPurchaseData)
                .then(() => {
                    return res.status(201).redirect("/istorija-detalji/" + purchase._id + "?purchase=true")
                })
                .catch(err => {
                    const error = new Error("Nije moguće sačuvati promene na Akciji!");
                    error.httpStatusCode = 409;
                    return next(error);
                })
        } else {
            const book = await Book.findById(purchase.data.bookId._id)
                .select("title description coverImage author recipes __v")
                .populate({
                    path: 'recipes.recipeId',
                    model: "Recipe",
                    select: "title category description preparation ingredients nutritions featureImage images previousVersions __v"
                })
                .catch(err => {
                    const error = new Error("Nije moguće pronaći Recept!");
                    error.httpStatusCode = 404;
                    return next(error);
                })
            let recipes = [];
            book.recipes.forEach(recipe => {
                recipes.push({
                    recipeId: {
                        _id: recipe.recipeId._id,
                        title: recipe.recipeId.title,
                        description: recipe.recipeId.description,
                        category: recipe.recipeId.category,
                        featureImage: recipe.recipeId.featureImage,
                        images: recipe.recipeId.images,
                        ingredients: recipe.recipeId.ingredients,
                        nutritions: recipe.recipeId.nutritions,
                        preparation: {
                            note: recipe.recipeId.preparation.note,
                            duration: recipe.recipeId.preparation.duration,
                            steps: recipe.recipeId.preparation.steps
                        },
                        __v: recipe.recipeId.__v
                    }
                })
            })

            let newPurchaseData = new Purchase({
                _id: purchase._id,
                data: {
                    bookId: book._id,
                    title: book.title,
                    description: book.description,
                    coverImage: book.coverImage,
                    recipes: recipes,
                    author: book.author,
                    boughtVersion: book.__v,
                    previousVersions: purchase.data.previousVersions
                },
                __v: purchase.__v + 1
            })

            return Purchase.updateOne({ _id: purchase._id }, newPurchaseData)
                .then(() => {
                    return res.status(201).redirect("/istorija-detalji/" + purchase._id + "?purchase=true")
                })
                .catch(err => {
                    const error = new Error("Nije moguće sačuvati promene na Akciji!");
                    error.httpStatusCode = 409;
                    return next(error);
                })
        }
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postAddUserToEvent = async (req, res, next) => {
    try {
        const eventId = req.body.eventId;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).redirect("/dogadjaj-detalji/"+eventId);
        };

        const userId = req.body.userId;

        const user = await User.findById(userId)
            .select("username userImage wallet history");

        const event = await Event.findById(eventId);

        if (!user || !event) {
            return res.status(422).redirect("/dogadjaj-detalji/"+eventId);
        }

        if (event.type === "public") {
            event.participants.push({
                userId: user._id,
                username: user.username,
                userImage: user.userImage,
                isWinner: false
            })

            event.save().then(() => {
                return res.status(200).redirect("/dogadjaj-detalji/"+eventId);
            })
        }

    } catch (err) {
        const error = new Error("Desila se neočekivana greška! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postAddRecipeToEvent = async (req, res, next) => {
    try {
        const eventId = req.body.eventId;
        const recipeId = req.body.recipeId;
        const userId = req.session.user._id;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).redirect("/dogadjaj-detalji/"+eventId);
        };

        const user = await User.findById(userId)
            .select("username userImage");

        const recipe = await Recipe.findById(recipeId)
            .select("title description featureImage images ingredients preparation nutritions");

        const event = await Event.findById(eventId)
            .then(event => {
                event.content.push({
                    author: {
                        userId: user._id,
                        username: user.username,
                        userImage: user.userImage
                    },
                    recipe: {
                        recipeId: recipe._id,
                        title: recipe.title,
                        description: recipe.description,
                        featureImage: recipe.featureImage,
                        images: recipe.images,
                        ingredients: recipe.ingredients,
                        preparation: recipe.preparation,
                        nutritions: recipe.nutritions
                    },
                    votes: {
                        count: 0,
                        users: []
                    }
                })

                event.save()
                    .then(() => {
                        return res.status(200).redirect("/dogadjaj-detalji/"+eventId);
                    })
            })
        
    } catch (err) {
        const error = new Error("Desila se neočekivana greška! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postVoteForRecipe = (req, res, next) => {
    try {
        const eventId = req.body.eventId;
        const recipeId = req.body.recipeId;

        console.log(recipeId);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).redirect("/dogadjaj-detalji/"+eventId);
        };

        const userId = req.session.user._id;

        const event = Event.findById(eventId)
            .then(event => {
                const targetRecipe = event.content.find(contentItem => contentItem.recipe.recipeId.equals(recipeId));

                targetRecipe.votes.count += 1;
                targetRecipe.votes.users.push({userId: new mongoose.Types.ObjectId(userId)});

                event.save().then(() => {
                    return res.status(200).redirect("/dogadjaj-detalji/"+eventId);
                })
            });

    } catch (err) {
        const error = new Error("Desila se neočekivana greška! ovde puca " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}