// Controllers for user routes and function to the database
const mongoose = require("mongoose");
const crypto = require("crypto");

// Import Models to be used and passed to template
const User = require("../models/user");
const Recipe = require("../models/recipe");
const Book = require("../models/book");
const History = require("../models/history");
const nodemailer = require("nodemailer");
const { validationResult } = require("express-validator");
const cloudinaryServices = require('../util/cloudinaryServices.js');

const fs = require('fs').promises;
const path = require('path');

const ITEMS_PER_PAGE = 10;

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
        const data = await fs.readFile(filePath, 'utf-8');
        const allCategories = JSON.parse(data);
        return allCategories;
      } catch (err) {
        throw new Error('Error reading JSON file: ' + err);
      }
}
//------------------------------------------ GET Functions --------------------------------------------------

exports.getAdminProfile = (req, res, next) => {
    // Fetch statistic data from database such as number of users,
    // recipes, books, most viewed and most saved recipe, book, user
    // and top recipe, book and user of this month and overall
    // Render adminProfile page and populate with data
    next();
};

exports.getAdminRecipes = async (req, res, next) => {
    try {
        let searchCategory, searchCond, recipeTotalItems, totalItems;

        if (req.query.search) {
            searchCond = req.query.search;

            totalItems = await Recipe.aggregate([
                {
                    $lookup: {
                        from: 'users', // Name of the User collection in MongoDB
                        localField: 'author',
                        foreignField: '_id',
                        as: 'authorDetails'
                    }
                },
                {
                    $unwind: '$authorDetails'
                },
                {
                    $match: {
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchCond) ? new mongoose.Types.ObjectId(searchCond) : null },
                            { title: { $regex: searchCond, $options: 'i' } },
                            { category: { $regex: searchCond, $options: 'i' } },
                            { 'authorDetails.username': { $regex: searchCond, $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        category: 1,
                        author: 1,
                        username: '$authorDetails.username' // Include only the username from the author details
                    }
                },
                {
                    $count: "totalItems" // This will add a field `totalItems` with the count of matching documents
                }
            ]);

            recipeTotalItems = totalItems.length > 0 ? totalItems[0].totalItems : 0;
        } else {
            recipeTotalItems = await Recipe.find().countDocuments();
        }

        const recipePage = Math.max(1, +req.query.recipePage || 1);


        const lastPage = Math.max(1, Math.ceil(recipeTotalItems / ITEMS_PER_PAGE));
        let recipes;

        if (searchCond) {
            recipes = await Recipe.aggregate([
                {
                    $lookup: {
                        from: 'users', // Name of the User collection in MongoDB
                        localField: 'author',
                        foreignField: '_id',
                        as: 'author'
                    }
                },
                {
                    $unwind: '$author'
                },
                {
                    $match: {
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchCond) ? new mongoose.Types.ObjectId(searchCond) : null },
                            { title: { $regex: searchCond, $options: 'i' } },
                            { category: { $regex: searchCond, $options: 'i' } },
                            { 'author.username': { $regex: searchCond, $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        category: 1,
                        description: 1,
                        featureImage: 1,
                        author: 1,
                        preparation: {
                            duration: 1
                        },
                        ratings: 1,
                        type: 1,
                        cost: 1,
                        username: '$author.username' // Include only the username from the author details
                    }
                },
                {
                    $sort: { "createdAt": -1 }
                },
                {
                    $skip: (recipePage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                }
            ])
                .catch(err => {
                    const error = new Error("Unable to find recipes! " + err);
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            recipes = await Recipe.find()
                .sort({ "createdAt": -1 })
                .skip((recipePage - 1) * ITEMS_PER_PAGE)
                .limit(ITEMS_PER_PAGE)
                .select("title category description featureImage author preparation.duration ratings type cost")
                .populate("author", "username userImage")
                .then()
                .catch(err => {
                    const error = new Error("Unable to find recipes! " + err);
                    error.httpStatusCode = 404;
                    return next(error);
                })
        }


        return res.status(200).render('admin/recipes', {
            path: '/admin/recipes',
            pageTitle: 'All Recipes',
            pageDescription: "",
            pageKeyWords: "",
            recipes: recipes,
            currentPage: recipePage,
            hasNextPage: ITEMS_PER_PAGE * recipePage < recipeTotalItems,
            hasPreviousPage: recipePage > 1,
            nextPage: recipePage + 1,
            previousPage: recipePage - 1,
            lastPage: lastPage,
            searchCategory: searchCategory,
            searchCond: searchCond
        })
    } catch (err) {
        const error = new Error("Unabel to find recipes! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAdminBooks = async (req, res, next) => {
    try {
        let searchCategory, searchCond, bookTotalItems, totalItems;

        if (req.query.search) {
            searchCond = req.query.search;

            totalItems = await Book.aggregate([
                {
                    $lookup: {
                        from: 'users',
                        localField: 'author',
                        foreignField: '_id',
                        as: 'authorDetails'
                    }
                },
                {
                    $unwind: '$authorDetails'
                },
                {
                    $match: {
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchCond) ? new mongoose.Types.ObjectId(searchCond) : null },
                            { title: { $regex: searchCond, $options: 'i' } },
                            { 'authorDetails.username': { $regex: searchCond, $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        author: 1,
                        username: '$authorDetails.username'
                    }
                },
                {
                    $count: "totalItems"
                }
            ]);

            bookTotalItems = totalItems.length > 0 ? totalItems[0].totalItems : 0;
        } else {
            bookTotalItems = await Book.find().countDocuments();
        }

        const bookPage = Math.max(1, +req.query.bookPage || 1);
        const lastPage = Math.max(1, Math.ceil(bookTotalItems / ITEMS_PER_PAGE));
        let books;

        if (searchCond) {
            books = await Book.aggregate([
                {
                    $lookup: {
                        from: 'users', // Name of the User collection in MongoDB
                        localField: 'author',
                        foreignField: '_id',
                        as: 'author'
                    }
                },
                {
                    $unwind: '$author'
                },
                {
                    $match: {
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchCond) ? new mongoose.Types.ObjectId(searchCond) : null },
                            { title: { $regex: searchCond, $options: 'i' } },
                            { 'author.username': { $regex: searchCond, $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        description: 1,
                        coverImage: 1,
                        author: 1,
                        type: 1,
                        cost: 1,
                        username: '$author.username' // Include only the username from the author details
                    }
                },
                {
                    $sort: { "createdAt": -1 }
                },
                {
                    $skip: (bookPage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                }
            ])
                .catch(err => {
                    const error = new Error("Unable to find books! " + err);
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            books = await Book.find()
                .sort({ "createdAt": -1 })
                .skip((bookPage - 1) * ITEMS_PER_PAGE)
                .limit(ITEMS_PER_PAGE)
                .select("title type description coverImage author views cost")
                .populate("author", "username userImage")
                .then()
                .catch(err => {
                    const error = new Error("Unable to find Books! " + err);
                    error.httpStatusCode = 404;
                    return next(error);
                })
        }

        return res.status(200).render('admin/books', {
            path: '/admin/books',
            pageTitle: 'All Books',
            pageDescription: "",
            pageKeyWords: "",
            books: books,
            currentPage: bookPage,
            hasNextPage: ITEMS_PER_PAGE * bookPage < bookTotalItems,
            hasPreviousPage: bookPage > 1,
            nextPage: bookPage + 1,
            previousPage: bookPage - 1,
            lastPage: lastPage,
            searchCategory: searchCategory,
            searchCond: searchCond
        })
    } catch (err) {
        const error = new Error("Unable to find Books! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};
exports.getAdminUsers = async (req, res, next) => {
    try {
        let searchCategory, searchCond, userTotalItems, totalItems;
        let loggedUserId = req.session.user._id || undefined;

        if (req.query.search) {
            searchCond = req.query.search;

            totalItems = await User.aggregate([
                {
                    $match: {
                        $and: [
                            { _id: { $ne: loggedUserId } },
                            {
                                $and: [
                                    { role: { $ne: "system" } },
                                ]
                            },
                            {
                                $or: [
                                    { _id: mongoose.Types.ObjectId.isValid(searchCond) ? new mongoose.Types.ObjectId(searchCond) : null },
                                    { username: { $regex: searchCond, $options: 'i' } },
                                    { role: { $regex: searchCond, $options: 'i' } },
                                    { email: { $regex: searchCond, $options: 'i' } },
                                    { status: { $regex: searchCond, $options: 'i' } }
                                ]
                            }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        username: 1,
                        role: 1,
                        email: 1
                    }
                },
                {
                    $count: "totalItems"
                }
            ]);

            userTotalItems = totalItems.length > 0 ? totalItems[0].totalItems : 0;
        } else {
            userTotalItems = await User.find({
                _id: { $ne: loggedUserId },
                role: { $nin: ["system"] }
            }).countDocuments();
        }

        const userPage = Math.max(1, +req.query.userPage || 1);
        const lastPage = Math.max(1, Math.ceil(userTotalItems / ITEMS_PER_PAGE));
        let users;

        if (searchCond) {
            users = await User.aggregate([
                {
                    $match: {
                        $and: [
                            { _id: { $ne: loggedUserId } },
                            {
                                $and: [
                                    { role: { $ne: "system" } }
                                ]
                            },
                            {
                                $or: [
                                    { _id: mongoose.Types.ObjectId.isValid(searchCond) ? new mongoose.Types.ObjectId(searchCond) : null },
                                    { username: { $regex: searchCond, $options: 'i' } },
                                    { role: { $regex: searchCond, $options: 'i' } },
                                    { email: { $regex: searchCond, $options: 'i' } },
                                    { status: { $regex: searchCond, $options: 'i' } }
                                ]
                            }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        username: 1,
                        role: 1,
                        email: 1,
                        userImage: 1,
                        status: 1,
                    }
                },
                {
                    $sort: { "createdAt": -1 }
                },
                {
                    $skip: (userPage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                }
            ])
                .catch(err => {
                    const error = new Error("Unable to find Users! " + err);
                    error.httpStatusCode = 404;
                    return next(error);
                });
        } else {
            users = await User.find({ role: { $ne: "system" }, _id: { $ne: loggedUserId } })
                .sort({ "createdAt": -1 })
                .skip((userPage - 1) * ITEMS_PER_PAGE)
                .limit(ITEMS_PER_PAGE)
                .select("username role email userImage status")
                .then()
                .catch(err => {
                    const error = new Error("Unable to find Users! " + err);
                    error.httpStatusCode = 404;
                    return next(error);
                })
        }

        return res.status(200).render('admin/users', {
            path: '/admin/users',
            pageTitle: 'All Users',
            pageDescription: "",
            pageKeyWords: "",
            users: users,
            currentPage: userPage,
            hasNextPage: ITEMS_PER_PAGE * userPage < userTotalItems,
            hasPreviousPage: userPage > 1,
            nextPage: userPage + 1,
            previousPage: userPage - 1,
            lastPage: lastPage,
            searchCategory: searchCategory,
            searchCond: searchCond
        })
    } catch (err) {
        const error = new Error("Unable to find Users! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAdminRecipeById = (req, res, next) => {
    try {
        const recipeId = req.params.recipeId;

        Recipe.findById(recipeId)
            .populate("author buyers.userId ratings.userId", "username userImage")
            .populate({
                path: 'history.historyId',
                select: 'type date cost purchaseId',
                populate: {
                    path: 'purchaseId',
                    select: 'data'
                }
            })
            .then(recipe => {
                return res.status(200).render("admin/new-recipe-details", {
                    path: "/admin/recipe-details",
                    pageTitle: "Recipe Details",
                    pageDescription: "",
                    pageKeyWords: "",
                    recipe: recipe,
                    user: req.session.user
                });
            })
            .catch(err => {
                const error = new Error("Unable to find this Recipe! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Unable to find that Recipe! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAdminBookById = async (req, res, next) => {
    try {
        const bookId = req.params.bookId;
        const user = await User.findById(req.session.user._id)
            .select("savedBooks role")
            .catch(err => {
                const error = new Error("Unable to find that user! " + err);
                error.httpStatusCode = 404;
                return next(error);
            });

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
                return res.status(200).render("admin/book-details", {
                    path: "/admin/book-details",
                    pageTitle: "Book Details",
                    pageDescription: "",
                    pageKeyWords: "",
                    book: book,
                    user: user
                });
            })
            .catch(err => {
                const error = new Error("Unable to find this Book! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Unable to find this Book! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAdminUserById = (req, res, next) => {
    try {
        const userId = req.params.userId;
        const loggedUser = req.session.user;

        if (loggedUser._id.toString() === userId.toString()) {
            return res.status(422).redirect("/moj-profil");
        }
        User.findById(userId)
            .select("-password -acceptance -blocking -blockedBy")
            .populate({
                path: 'userRecipes.recipeId',
                populate: {
                    path: 'author',
                    select: 'userImage username'
                },
                select: 'title category author description featureImage preparation.duration ratings type cost buyers'
            }).populate({
                path: 'userBooks.bookId',
                populate: {
                    path: 'author',
                    select: "userImage username"
                },
                select: 'title author description coverImage recipes type cost buyers'
            })
            .populate({
                path: 'history.historyId',
                select: 'type date cost purchaseId',
                populate: [
                    {
                        path: 'purchaseId',
                        select: 'data.title data.author data.userId data.username data.userImage',
                        populate: {
                            path: 'data.author',
                            model: 'User',
                            select: 'username'
                        }
                    }
                ]
            })
            .then(user => {
                if ((user.role === "system" || user.role === "admin") && loggedUser.role !== "system") {
                    return res.status(422).redirect("/korisnik-profil/" + user._id);
                }
                return res.status(200).render("admin/user-details", {
                    path: "/admin/user-details",
                    pageTitle: "User Details",
                    pageDescription: "",
                    pageKeyWords: "",
                    user: user
                });
            })
            .catch(err => {
                const error = new Error("Unable to find this User! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Unable to find this User! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};


exports.getAdminEditRecipe = async (req, res, next) => {
    try {
        const recipeId = req.params.recipeId;

        const userRole = req.session.user.role;
        const filePath = path.join(__dirname, '../public/json', 'categories.json');
        const categories = await getAllCategories(filePath);

        const recipe = Recipe.findById(recipeId)
        .then(recipe => {
            let existingData = req.existingData;
            if (existingData) {
                existingData = existingData;
            } else {
                existingData = null;
            };

            // Render addRecipe Page
            return res.status(200).render("user/new-add-recipe", {
                path: "/dodajte-recept",
                pageTitle: "Recept Izmena",
                pageDescription: "",
                pageKeyWords: "",
                existingData: existingData,
                errorMessage: "",
                userRole: userRole,
                editing: true,
                isAdmin: true,
                recipe: recipe,
                categories: categories
            })
        });
    } catch (err) {
        const error = new Error("Desila se neocekivana greska! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAdminEditBook = (req, res, next) => {
    try {
        const bookId = req.params.bookId;

        const userRole = req.session.user.role;

        const book = Book.findById(bookId)
        .then(book => {
            let existingData = req.existingData;
            if (existingData) {
                existingData = existingData;
            } else {
                existingData = null;
            };

            return res.status(200).render("user/new-add-book", {
                path: "/dodajte-knjigu",
                pageTitle: "Knjiga Izmena",
                pageDescription: "",
                pageKeyWords: "",
                existingData: existingData,
                errorMessage: "",
                userRole: userRole,
                editing: true,
                isAdmin: true,
                book: book
            })
        });
    } catch (err) {
        const error = new Error("Desila se neocekivana greska! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getAdminEditUser = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const loggedUser = req.session.user;
        await User.findById(userId)
            .select("email username userImage role")
            .then(user => {
                return res.status(200).render("admin/edit-user", {
                    path: "/admin/izmenite-korisnika",
                    pageTitle: "Izmenite Korisnika",
                    pageDescription: "",
                    pageKeyWords: "",
                    user: user,
                    loggedUser: loggedUser
                });
            })
            .catch(err => {
                const error = new Error("Unable to find that User! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Unable to find that User! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getHistoryById = (req, res, next) => {
    try {
        const historyId = req.params.historyId;

        return History.findById(historyId)
            .populate({
                path: 'purchaseId',
                select: 'data',
                populate: {
                    path: 'data.author data.userId',
                    model: 'User',
                    select: 'username userImage'
                }
            })
            .then(history => {
                if (history.type === "requestedWithdrawal") {
                    const decryptedAESKey = decryptAESKey(history.purchaseId.data.aesKey, privateKey);

                    const decryptedFirstname = decryptData(history.purchaseId.data.firstname, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));
                    const decryptedLastname = decryptData(history.purchaseId.data.lastname, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));
                    const decryptedAccountNumber = decryptData(history.purchaseId.data.accountNumber, decryptedAESKey, Buffer.from(history.purchaseId.data.iv, 'hex'));

                    return res.status(200).render("user/user-includes/new-history-details", {
                        path: "/istorija-detalji",
                        pageTitle: "Istorija Detalji",
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
                        haveNewVersion: false
                    });
                }

                return res.status(200).render("user/user-includes/new-history-details", {
                    path: "/istorija-detalji",
                    pageTitle: "Istorija Detalji",
                    pageDescription: "",
                    pageKeyWords: "",
                    history: history,
                    userRole: req.session.user.role,
                    haveNewVersion: false
                });
            })
            .catch(err => {
                const error = new Error("Couldn't find history! " + err);
                error.httpStatusCode = 500;
                return next(error);
            })
    } catch (err) {
        const error = new Error("Desila se neočekivana greška");
        error.httpStatusCode = 500;
        return next(error);
    }
}

// ----------------------------------- POST Functions ---------------------------------------

exports.postRecipeSearch = (req, res, next) => {
    try {
        const searchParams = req.body.searchParams;

        return res.redirect('/admin/recepti?search=' + searchParams);
    } catch (err) {
        const error = new Error("Unable to post search params! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postBookSearch = (req, res, next) => {
    try {
        const searchParams = req.body.searchParams;

        return res.redirect('/admin/knjige?search=' + searchParams);
    } catch (err) {
        const error = new Error("Unable to post search params! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postUserSearch = (req, res, next) => {
    try {
        const searchParams = req.body.searchParams;

        return res.redirect('/admin/korisnici?search=' + searchParams);
    } catch (err) {
        const error = new Error("Unable to post search params! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAdminEditRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
                    cost: cost || ' ',
                },
                recipe: new mongoose.Types.ObjectId(recipeId),
                userRole: userRole,
                editing: true,
                isAdmin: true,
                categories: allCategories
            });
        }

        // Find the recipe by id
        const oldRecipe = await Recipe.findById(recipeId).session(session);
        if (!oldRecipe) {
            throw new Error("Nije moguće pronaći Recept!");
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

        return res.redirect("/admin/recept-detalji/" + recipeId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error("Nije moguće sačuvati promene na Receptu! "+ err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAdminEditBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userRole = req.session.user.role;
        const bookId = req.body.bookId;

        const oldBook = await Book.findById(bookId)
            .select("title description author coverImage type cost")
            .session(session);

        if (!oldBook) {
            throw new Error("Nije moguće pronaći Knjigu!");
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
                book: oldBook,
                isAdmin: true
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

        return res.status(201).redirect("/admin/knjiga-detalji/" + bookId);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const error = new Error("Nije moguće sačuvati promene na Knjizi!");
        error.httpStatusCode = err.httpStatusCode || 500;
        return next(error);
    }
};

exports.postAdminEditUser = (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const error = new Error(errors.array()[0].msg);
            error.httpStatusCode = 422;
            return next(error);
        }

        const userId = req.body.userId;
        const username = req.body.username;
        const email = req.body.email;
        const role = req.body.role;
        const changeImage = req.body.changeImage;

        User.findById(userId)
            .select("username email userImage role status")
            .then(user => {
                let cond = false;
                if (user.username !== username) {
                    user.username = username;
                    cond = true;
                }
                if (user.email !== email) {
                    user.email = email;
                    cond = true;
                }
                if (user.role !== role) {
                    user.role = role;
                    cond = true;
                    if (user.role === 'creator') {
                        const isRequested = user.status.find(status => status === 'requestedCreator');
                        if (isRequested) {
                            let status = user.status.filter(status => status !== 'requestedCreator');
                            user.status = status;
                        }
                    }
                }
                if (changeImage === 'on') {
                    user.userImage = '/images/default-user.png'
                    cond = true;
                }

                if (!cond) {
                    return res.status(304).redirect('/admin/korisnik-detalji/' + userId);
                }

                user.save()
                    .then(() => {
                        return res.status(201).redirect('/admin/korisnik-detalji/' + userId);
                    })
                    .catch(err => {
                        const error = new Error("Unable to save changes to User! " + err);
                        error.httpStatusCode = 422;
                        return next(error);
                    })
            })
            .catch(err => {
                const error = new Error("unable to find that User! " + err);
                error.httpStatusCode = 404;
                return next(error);
            })

    } catch (err) {
        const error = new Error("Desila se neočekivana greška");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAdminDeleteRecipe = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const recipeId = req.body.recipeId;

        const recipeBuyers = await Recipe.findById(recipeId).select('buyers').session(session);

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

        await User.updateMany(
            { "savedRecipes.recipeId": recipeId },
            { $pull: { "savedRecipes": { "recipeId": recipeId } } }
        ).session(session);

        await User.updateOne(
            { "userRecipes.recipeId": recipeId },
            { $pull: { "userRecipes": { "recipeId": recipeId } } }
        ).session(session);

        await Book.updateMany(
            { "recipes.recipeId": recipeId },
            { $pull: { "recipes": { "recipeId": recipeId } } }
        ).session(session);

        await Recipe.deleteOne({ "_id": recipeId }).session(session);

        await session.commitTransaction();
        session.endSession();

        return res.status(204).redirect('/admin/recepti');

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error(err.message);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAdminDeleteBook = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bookId = req.body.bookId;

        const bookBuyers = await Book.findById(bookId).select('buyers').session(session);

        if (bookBuyers.buyers.length < 1) {
            const bookToDelete = await Book.findById(bookId);

            if (bookToDelete.coverImage !== '/images/default_book.png') {
                const coverImagePath = bookToDelete.coverImage;

                if (coverImagePath.startsWith('/images/uploads/')) {
                    const publicId = coverImagePath.replace('/images/', "");
                    deleteImage(publicId, bookToDelete.type === 'public')
                }
            }
        }

        await User.updateMany(
            { "savedBooks.bookId": bookId },
            { $pull: { "savedBooks": { "bookId": bookId } } }
        ).session(session);

        await User.updateOne(
            { "userBooks.bookId": bookId },
            { $pull: { "userBooks": { "bookId": bookId } } }
        ).session(session);

        await Book.deleteOne({ "_id": bookId }).session(session);

        await session.commitTransaction();
        session.endSession();

        return res.status(204).redirect('/admin/knjige');

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error(err.message);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postAdminDeleteUser = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.params.userId;
        const loggedUserId = req.session.user._id;
        const systemUser = User.findOne({role: "system"}). select("systemWallet wallet");

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const error = new Error(errors.array()[0].msg);
            error.httpStatusCode = 422;
            return next(error);
        }

        if (userId.toString() === loggedUserId.toString()) {
            const error = new Error("Nije moguće izbrisati sebe!");
            error.httpStatusCode(422);
            return next(error);
        };

        const user = await User.findById(userId)
            .select("userRecipes userBooks subscribers subscribed followers following wallet");

        const userRecipes = [];
        if (user.userRecipes.length > 0) {
            user.userRecipes.forEach(recipe => {
                userRecipes.push(recipe);
            })

            userRecipes.forEach(recipe => {
                deleteRecipe(recipe._id, session);
            })
        }

        const userBooks = [];
        if (user.userBooks.length > 0) {
            user.userBooks.forEach(book => {
                userBooks.push(book);
            });

            userBooks.forEach(book => {
                deleteBook(book._id, session);
            })
        }

        await User.updateMany(
            { "followers.users.userId": userId },
            { $pull: { "users": { "userId": userId } } }
        )

        await User.updateMany(
            { "following.users.userId": userId },
            { $pull: { "users": { "userId": userId } } }
        )

        await User.updateMany(
            { "subscribers.users.userId": userId },
            { $pull: { "users": { "userId": userId } } }
        )

        await User.updateMany(
            { "subscribed.users.userId": userId },
            { $pull: { "users": { "userId": userId } } }
        )


        systemUser.systemWallet -= user.wallet;
        systemUser.wallet += user.wallet;

        await systemUser.save(session);

        await User.deleteOne(user._id);

        console.log("User has been deleted!");

        await session.commitTransaction();
        session.endSession();
    } catch (err) {
        const error = new Error("Desila se neočekivana greška");
        error.httpStatusCode = 500;
        return next(error);
    }
};

async function deleteUser(id) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = id;
        const systemUser = await User.findOne({role: "system"}).select("systemWallet wallet");

        console.log(systemUser);

        const user = await User.findById(userId)
            .select("userImage userRecipes userBooks subscribers subscribed followers following wallet");

        if (user.userImage.includes('/images/uploads/')) {
            const publicId = user.userImage.replace('/images/',"");
            cloudinaryServices.deleteImage(publicId);
        }

        const userRecipes = [];
        if (user.userRecipes.length > 0) {
            user.userRecipes.forEach(recipe => {
                userRecipes.push(recipe);
            })

            userRecipes.forEach(recipe => {
                deleteRecipe(recipe._id, session);
            })
        }

        const userBooks = [];
        if (user.userBooks.length > 0) {
            user.userBooks.forEach(book => {
                userBooks.push(book);
            });

            userBooks.forEach(book => {
                deleteBook(book._id, session);
            })
        }

        await User.updateMany(
            { "followers.users.userId": user._id },
            { 
                $pull: { "followers.users": { "userId": user._id } },
                $inc: { "followers.count": -1 }
            },
            { session }
        ).then(() => console.log("Success 1!"));

        await User.updateMany(
            { "following.users.userId": user._id },
            { 
                $pull: { "following.users": { "userId": user._id } },
                $inc: { "following.count": -1 }
            },
            { session }
        ).then(() => console.log("Success 2!"));

        await User.updateMany(
            { "subscribers.users.userId": user._id },
            { 
                $pull: { "subscribers.users": { "userId": user._id } },
                $inc: { "subscribers.count": -1 }
            },
            { session }
        ).then(() => console.log("Success 3!"));

        await User.updateMany(
            { "subscribed.users.userId": user._id },
            { 
                $pull: { "subscribed.users": { "userId": user._id } },
                $inc: { "subscribed.count": -1 }
            },
            { session }
        ).then(() => console.log("Success 4!"));

        await User.updateMany(
            { "blocking.userId": user._id },
            { $pull: { "blocking": { "userId": user._id } } },
            { session }
        ).then(() => console.log("Success 5!"));

        await User.updateMany(
            { "blockedBy.userId": user._id },
            { $pull: { "blockedBy": { "userId": user._id } } },
            { session }
        ).then(() => console.log("Success 6!"));

        systemUser.systemWallet -= user.wallet;
        systemUser.wallet += user.wallet;

        await systemUser.save(session).then(()=>console.log("Success System!"));;

        await User.deleteOne(user._id);

        console.log("User has been deleted!");

        await session.commitTransaction();
        session.endSession();
    } catch (err) {
        throw new Error("Desila se neočekivana greška");
    }
}

async function deleteRecipe(id, session) {
    try {
        await User.updateMany(
            { "savedRecipes.recipeId": id },
            { $pull: { "savedRecipes": { "recipeId": id } } }
        ).session(session);

        await Recipe.findById(id)
            .select("buyers featureImage images type")
            .then(recipe => {
                if (recipe.buyers.length < 1) {
                    const images = [...featureImage, ...images];
                    cloudinaryServices.deleteImage(images, type === 'public');
                }
            }).session(session);

        await Book.updateMany(
            { "recipes.recipeId": id },
            { $pull: { "recipes": { "recipeId": id } } }
        ).session(session);

        await Recipe.deleteOne({ "_id": _id }).session(session);

        return console.log("Success!");
    } catch (err) {
        throw new Error("Desila se neočekivana greška");
    }
};

async function deleteBook(id, session) {
    try {
        await User.updateMany(
            { "savedBooks.bookId": id },
            { $pull: { "savedBooks": { "bookId": id } } }
        ).session(session);

        await Book.findById(id)
            .select("buyers coverImage type")
            .then(book => {
                if (book.buyers.length < 1) {
                    const images = coverImage;
                    cloudinaryServices.deleteImage(images, type === 'public');
                }
            }).session(session);

        await Book.deleteOne({ "_id": _id }).session(session);

        return console.log("Success!");
    } catch (err) {
        throw new Error("Desila se neočekivana greška");
    }
};

exports.postDeactivateUser = async (req, res, next) => {
    try {
        const userId = req.body.userId;

        const user = await User.findById(userId).select("status");

        const isUserActive = user.status.find(stat => stat === 'active');

        if (isUserActive) {
            user.status.push('inactive');
            const newStatus = user.status.filter(stat => !['active', 'requestedDeactivation'].includes(stat));
            user.status = newStatus;

            user.save()
                .then(() => {
                    return res.redirect('/admin/korisnik-detalji/'+ userId);
                })
        } else {
            const error = new Error("Ovaj korisnik je već inaktivan!");
            error.httpStatusCode = 409;
            return next(error);
        }

    } catch (err) {
        const error = new Error("Nije mogu'e deaktivirati Korisnika!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postActivateUser = async (req, res, next) => {
    try {
        const userId = req.body.userId;

        const user = await User.findById(userId).select("status");

        const isUserInactive = user.status.find(stat => stat === 'inactive');

        if (isUserInactive) {
            user.status.push('active');
            const newStatus = user.status.filter(stat => !['inactive', 'requestedDeactivation'].includes(stat));
            user.status = newStatus;

            user.save()
                .then(() => {
                    return res.redirect('/admin/korisnik-detalji/'+ userId);
                })
        } else {
            const error = new Error("Ovaj korisnik je već aktivan!");
            error.httpStatusCode = 409;
            return next(error);
        }

    } catch (err) {
        const error = new Error("Nije mogu'e deaktivirati Korisnika!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postSuspendUser = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.body.userId;

        const user = await User.findById(userId).select('username email status').session(session);
        if (!user) {
            throw new Error("Nije moguće pronaći Korisnika!");
        }

        const isSuspended = user.status.includes('suspended');
        if (isSuspended) {
            throw new Error("Korisnik je već suspendovan!");
        }

        user.status = user.status.filter(status => !['active', 'inactive', 'requestedDeactivation'].includes(status));
        user.status.push('suspended');

        const currentDate = new Date();
        const futureDate = new Date(currentDate);
        futureDate.setDate(currentDate.getDate() + 30);
        user.deleteDate = futureDate;

        const withdrawalToken = crypto.randomBytes(32).toString('hex');
        user.withdrawalToken = withdrawalToken;

        const futureWithdrawalDate = new Date(currentDate);
        futureWithdrawalDate.setDate(currentDate.getDate() + 27);
        user.withdrawalTokenExpiration = futureWithdrawalDate;

        const options = {
            timeZone: 'Europe/Belgrade',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('sr-RS', options);
        const formattedDate = formatter.format(futureWithdrawalDate);

        await user.save({ session });

        const mailOptions = {
            from: "Kuvajmo Zajedno",
            to: user.email,
            subject: "Vaš nalog je suspendovan!",
            text: "Imate vremena do: " + formattedDate + " da zatražite isplatu za ostatak vašeg balansa!",
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Vaš nalog je suspendovan</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #ad1b1b; margin-bottom: 20px;">Vaš nalog je suspendovan!</h1>
                        <h2 style="color: #009688; margin-bottom: 10px;">Imate vremena do: ${formattedDate} da zatražite isplatu za ostatak vašeg balansa!</h2>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                        <p style="color: #ad1b1b; font-size: 16px; margin-bottom: 30px;">Vaš nalog je suspendovan!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Imate vremena do: ${formattedDate} da zatražite isplatu za ostatak vašeg balansa!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Standardna provizija od <strong>20%</strong> biće naplaćena na željeni iznos!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Kliknite na link da nastavite sa procesom isplate.</p>
                        <a href="https://www.kuvajmozajedno.com/zatrazite-isplatu/${withdrawalToken}" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Nastavite sa Isplatom</a>
                    </div>
                </body>
                </html>
            `,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                throw new Error("Nije moguće poslati email!");
            }
        });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).redirect("/admin/korisnik-detalji/" + user._id);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        const error = new Error(err.message);
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.postUnsuspendUser = (req, res, next) => {

}

exports.checkUsersSuspention = async (req, res, next) => {
    try {
        const users = await User.find({ status: { $in: ['inactive'] } })
            .select("suspendDate");

        const suspendUsers = [];
        if (users.length > 0) {
            users.forEach(user => {
                if (!user.suspendDate || (user.suspendDate < Date.now())) {
                    suspendUsers.push(user);
                    console.log(user._id + " Zreo za suspenziju!");
                } else {
                    console.log(user._id + " Ima jos fore!");
                }
            })
        }

        if (suspendUsers.length > 0) {
            const ids = suspendUsers.map(obj => obj._id);
            ids.forEach(id => {
                suspendUser(id);
            })
        } else {
            console.log("Nema Korisnika za suspenziju.");
        }
    } catch (err) {
        throw new Error("Desila se neočekivana greška");
    }
}

async function suspendUser(id) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = id;

        const user = await User.findById(userId).select('username email status').session(session);
        if (!user) {
            throw new Error("Nije moguće pronaći Korisnika!");
        }

        const isSuspended = user.status.includes('suspended');
        if (isSuspended) {
            throw new Error("Korisnik je već suspendovan!");
        }

        user.status = user.status.filter(status => !['active', 'inactive', 'requestedDeactivation'].includes(status));
        user.status.push('suspended');

        const currentDate = new Date();
        const futureDate = new Date(currentDate);
        futureDate.setDate(currentDate.getDate() + 30);
        user.deleteDate = futureDate;

        const withdrawalToken = crypto.randomBytes(32).toString('hex');
        user.withdrawalToken = withdrawalToken;

        const futureWithdrawalDate = new Date(currentDate);
        futureWithdrawalDate.setDate(currentDate.getDate() + 27);
        user.withdrawalTokenExpiration = futureWithdrawalDate;

        const options = {
            timeZone: 'Europe/Belgrade',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('sr-RS', options);
        const formattedDate = formatter.format(futureWithdrawalDate);

        await user.save({ session });

        const mailOptions = {
            from: "Kuvajmo Zajedno",
            to: user.email,
            subject: "Vaš nalog je suspendovan!",
            text: "Imate vremena do: " + formattedDate + " da zatražite isplatu za ostatak vašeg balansa!",
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Vaš nalog je suspendovan</title>
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 20px;">
                    <div style="margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #ad1b1b; margin-bottom: 20px;">Vaš nalog je suspendovan!</h1>
                        <h2 style="color: #009688; margin-bottom: 10px;">Imate vremena do: ${formattedDate} da zatražite isplatu za ostatak vašeg balansa!</h2>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Pozdrav ${user.username},</p>
                        <p style="color: #ad1b1b; font-size: 16px; margin-bottom: 30px;">Vaš nalog je suspendovan!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Imate vremena do: ${formattedDate} da zatražite isplatu za ostatak vašeg balansa!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Standardna provizija od <strong>20%</strong> biće naplaćena na željeni iznos!</p>
                        <p style="color: #333; font-size: 16px; margin-bottom: 30px;">Kliknite na link da nastavite sa procesom isplate.</p>
                        <a href="https://www.kuvajmozajedno.com/zatrazite-isplatu/${withdrawalToken}" style="display: inline-block; padding: 12px 24px; background-color: #009688; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; transition: background-color 0.3s;">Nastavite sa Isplatom</a>
                    </div>
                </body>
                </html>
            `,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                throw new Error("Nije moguće poslati email!");
            }
        });

        await session.commitTransaction();
        session.endSession();
    } catch (err) {
        throw new Error("Desila se neočekivana greška");
    }
}

exports.checkUsersDelete = async (req, res, next) => {
    try {
        const users = await User.find({ status: { $in: ['suspended'] } })
            .select("deleteDate");

        if (users.length > 0) {
            const usersDelete = [];

            users.forEach(user => {
                if (!user.deleteDate || (user.deleteDate < Date.now())) {
                    usersDelete.push(user._id);
                }
            })

            usersDelete.forEach(user => {
                deleteUser(user._id);
            })
        } else {
            console.log("Trenutno još nema korinsika za brisanje!");
        }
    } catch (err) {
        return console.log(err);
    }
}