// Controllers for default routes and function to the database

const mongoose = require("mongoose");

// Import Models to be used and passed to template
const User = require("../models/user");
const Recipe = require("../models/recipe");
const Book = require("../models/book");
const Event = require("../models/event");

const cloudinary = require('cloudinary').v2;

const fs = require('fs');
const path = require('path');

const ITEMS_PER_PAGE = 6;

// GET Functions
exports.getChoseApp = (req, res, next) => {
    try {
        return res.render("default/chose-app", {
            path: '/',
            pageTitle: "Izaberite aplikaciju",
            pageDescription: "Izaberite aplikaciju koju želite, jedan nalog za sve, postanite deo zajednice!",
            pageKeyWords: "Kuvajmo Zajedno, Pronađi, Recepti, Knjige, Fitness, Fitnes Familija, Teretane, Treneri",
        })
    } catch (err) {
        const error = new Error("Error: " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getExplorer = async ( req, res, next ) => {
    try {
        let activeRecipe, activeBook, activeUser, searchCond;
        let searchCategory, searchRecipes, searchBooks, searchUsers;

        if (req.query.bookPage) {
            activeRecipe = undefined;
            activeBook = 'active';
            activeUser = undefined;
        }
        else if (req.query.userPage) {
            activeRecipe = undefined;
            activeBook = undefined;
            activeUser = 'active'
        } else if (req.query.recipePage) {
            activeRecipe = 'active';
            activeBook = undefined;
            activeUser = undefined;
        } else {
            if (req.query.category) {
                searchCategory = req.query.category;
                activeRecipe = 'active'
                activeBook = undefined;
                activeUser = undefined;
            } else if (req.query.searchRecipes || req.query.searchRecipes === "") {
                searchRecipes = req.query.searchRecipes;
                activeRecipe = 'active'
                activeBook = undefined;
                activeUser = undefined;
            } else if (req.query.searchBooks || req.query.searchBooks === "") {
                searchBooks = req.query.searchBooks;
                activeRecipe = undefined;
                activeBook = 'active';
                activeUser = undefined;
            } else if (req.query.searchUsers || req.query.searchUsers === "") {
                searchUsers = req.query.searchUsers;
                activeRecipe = undefined;
                activeBook = undefined;
                activeUser = 'active'
            } else {
                activeRecipe = 'active';
                activeBook = undefined;
                activeUser = undefined;
            }
        }

        const blockedUsers = [];
        if (req.session.user) {
            blockedUsers.push(...req.session.user.blockedBy.map(blocked => blocked.userId), ...req.session.user.blocking.map(block => block.userId));
        }

        const recipePage = Math.max(1, +req.query.recipePage || 1);
        const bookPage = Math.max(1, +req.query.bookPage || 1);
        const userPage = Math.max(1, +req.query.userPage || 1);

        const uniqueCategories = await Recipe.aggregate([
            { 
                $match: { 
                    type: "public" 
                } 
            },
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
                    'authorDetails.status': 'active'
                }
            },
            {
                $unwind: "$category"
            },
            {
                $group: { 
                    _id: "$category" 
                }
            },
            {
                $sort: { 
                    _id: 1 
                }
            }
        ]);

        let recipeTotalItems, recipes, books, bookTotalItems, users, userTotalItems;

        if (searchCategory) {
            // Pronađi ukupan broj recepata koji zadovoljavaju kriterijume
            let totalItems = await Recipe.aggregate([
                {
                    $match: {
                        type: "public",
                        author: { $nin: blockedUsers },
                        category: { $elemMatch: { $eq: req.query.category } }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
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
                        'author.status': 'active'
                    }
                },
                {
                    $count: 'totalCount'
                }
            ]);
        
            recipeTotalItems = totalItems[0].totalCount;
        
            // Pronađi recepte sa paginacijom, sortiranjem i selekcijom potrebnih polja
            recipes = await Recipe.aggregate([
                {
                    $match: {
                        type: "public",
                        author: { $nin: blockedUsers },
                        category: { $elemMatch: { $eq: req.query.category } }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
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
                        'author.status': { $in: ['active'] }
                    }
                },
                {
                    $sort: {
                        createdAt: -1,
                        'views.count': -1
                    }
                },
                {
                    $skip: (recipePage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                },
                {
                    $project: {
                        title: 1,
                        category: 1,
                        description: 1,
                        featureImage: 1,
                        'author._id': 1,
                        'author.username': 1,
                        'author.userImage': 1,
                        'author.role': 1,
                        'author.status': 1,
                        'preparation.duration': 1,
                        ratings: 1
                    }
                }
            ]);
        } else if (searchRecipes) {
            // Prebrojavanje dokumenata sa pretragom
            let totalItems = await Recipe.find({
                type: "public",
                author: { $nin: blockedUsers },
                $or: [
                    { _id: mongoose.Types.ObjectId.isValid(searchRecipes) ? new mongoose.Types.ObjectId(searchRecipes) : null },
                    { title: { $regex: searchRecipes.toString(), $options: 'i' } },
                    { category: { $regex: searchRecipes.toString(), $options: 'i' } },
                    { "author.username": { $regex: searchRecipes.toString(), $options: 'i' } }
                ]
            })
            .populate({
                path: 'author',
                match: { status: 'active' },
                select: 'username userImage role status'
            })
            .countDocuments();
        
            recipeTotalItems = totalItems;
        
            // Dohvatanje recepata sa paginacijom i sortiranjem
            recipes = await Recipe.find({
                type: "public",
                author: { $nin: blockedUsers },
                $or: [
                    { _id: mongoose.Types.ObjectId.isValid(searchRecipes) ? new mongoose.Types.ObjectId(searchRecipes) : null },
                    { title: { $regex: searchRecipes.toString(), $options: 'i' } },
                    { category: { $regex: searchRecipes.toString(), $options: 'i' } },
                    { "author.username": { $regex: searchRecipes.toString(), $options: 'i' } }
                ]
            })
            .populate({
                path: 'author',
                match: { status: 'active' },
                select: 'username userImage role status'
            })
            .sort({
                createdAt: -1,
                "views.count": -1
            })
            .skip((recipePage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .select("title category description featureImage author preparation.duration ratings");

            searchCond = searchRecipes;
        } else {
            // Prebrojavanje dokumenata bez pretrage
            let totalItems = await Recipe.aggregate([
                {
                    $match: {
                        type: "public",
                        author: { $nin: blockedUsers }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
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
                        'author.status': 'active'
                    }
                },
                {
                    $count: 'totalCount'
                }
            ]);
        
            recipeTotalItems = totalItems[0].totalCount;
        
            // Dohvatanje recepata sa paginacijom i sortiranjem
            recipes = await Recipe.aggregate([
                {
                    $match: {
                        type: "public",
                        author: { $nin: blockedUsers }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
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
                        'author.status': 'active'
                    }
                },
                {
                    $sort: {
                        createdAt: -1,
                        'views.count': -1
                    }
                },
                {
                    $project: {
                        title: 1,
                        category: 1,
                        description: 1,
                        featureImage: 1,
                        'author._id': 1,
                        'author.username': 1,
                        'author.userImage': 1,
                        'author.role': 1,
                        'preparation.duration': 1,
                        ratings: 1
                    }
                },
                {
                    $skip: (recipePage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                }
            ]);
        }
        
        
        if (searchBooks) {
            let totalItems = await Book.aggregate([
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
                        type: "public",
                        author: { $nin: blockedUsers },
                        'authorDetails.status': 'active',
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchBooks) ? new mongoose.Types.ObjectId(searchBooks) : null },
                            { title: { $regex: searchBooks.toString(), $options: 'i' } },
                            { "authorDetails.username": { $regex: searchBooks.toString(), $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        author: 1,
                        views: 1,
                        username: '$authorDetails.username',
                        role: '$authorDetails.role'
                    }
                },
                {
                    $count: "totalItems" // This will add a field `totalItems` with the count of matching documents
                }
            ])

            bookTotalItems = totalItems.length > 0 ? totalItems[0].totalItems : 0;

            books = await Book.aggregate([
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
                        type: "public",
                        author: { $nin: blockedUsers },
                        'authorDetails.status': 'active',
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchBooks) ? new mongoose.Types.ObjectId(searchBooks) : null },
                            { title: { $regex: searchBooks.toString(), $options: 'i' } },
                            { "authorDetails.username": { $regex: searchBooks.toString(), $options: 'i' } }
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
                        cost: 1,
                        views: 1,
                        recipes: 1,
                        username: '$authorDetails.username',
                        role: '$authorDetails.role'
                    }
                },
                {
                    $sort: {
                        createdAt: -1,
                        "views.count": -1
                    }
                },
                {
                    $skip: (bookPage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                }
            ])

            searchCond = searchBooks;
        } else {
            let totalItems = await Book.aggregate([
                {
                    $match: {
                        type: "public",
                        author: { $nin: blockedUsers }
                    }
                },
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
                        'authorDetails.status': 'active'
                    }
                },
                {
                    $count: 'totalItems'
                }
            ]);

            bookTotalItems = totalItems.length > 0 ? totalItems[0].totalItems : 0;

            books = await Book.aggregate([
                {
                    $match: {
                        type: "public",
                        author: { $nin: blockedUsers }
                    }
                },
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
                        'authorDetails.status': 'active'
                    }
                },
                {
                    $sort: {
                        createdAt: -1,
                        'views.count': -1
                    }
                },
                {
                    $skip: (bookPage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                },
                {
                    $project: {
                        title: 1,
                        description: 1,
                        coverImage: 1,
                        author: {
                            _id: '$authorDetails._id',
                            username: '$authorDetails.username',
                            userImage: '$authorDetails.userImage',
                            role: '$authorDetails.role'
                        },
                        views: 1,
                        recipes: 1
                    }
                }
            ]);
        }
        
        if (searchUsers) {
            let totalItems = await User.aggregate([
                {
                    $match: {
                        _id: {$nin: blockedUsers},
                        status: { $elemMatch: { $eq: 'active' } },
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchUsers) ? new mongoose.Types.ObjectId(searchUsers) : null },
                            { title: { $regex: searchUsers.toString(), $options: 'i' } },
                            { username: { $regex: searchUsers.toString(), $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        userImage: 1,
                        username: 1,
                        views: 1,
                    }
                },
                {
                    $count: "totalCount" // This will add a field `totalItems` with the count of matching documents
                }
            ]);

            users = await User.aggregate([
                {
                    $match: {
                        _id: {$nin: blockedUsers},
                        status: { $elemMatch: { $eq: 'active' } },
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(searchUsers) ? new mongoose.Types.ObjectId(searchUsers) : null },
                            { title: { $regex: searchUsers.toString(), $options: 'i' } },
                            { username: { $regex: searchUsers.toString(), $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        userImage: 1,
                        username: 1,
                        views: 1,
                    }
                },
                {
                    $skip: (userPage - 1) * ITEMS_PER_PAGE
                },
                {
                    $limit: ITEMS_PER_PAGE
                }
            ]);

            userTotalItems = totalItems.length > 0 ? totalItems[0].totalCount : 0;

            searchCond = searchUsers;
        } else {
            let totalItems = await User.find({
                _id: {$nin: blockedUsers},
                status: { $elemMatch: { $eq: 'active' } }
            }).countDocuments();

            userTotalItems = totalItems;
            
            users = await User.find({
                _id: {$nin: blockedUsers},
                status: { $elemMatch: { $eq: 'active' } }
            })
            .sort({
                createdAt: -1,
                "views.count": -1
            })
            .skip((userPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .select("_id username userImage role");
        }
        const lastRecipePage = Math.max(1, Math.ceil(recipeTotalItems / ITEMS_PER_PAGE));
        const lastBookPage = Math.max(1, Math.ceil(bookTotalItems / ITEMS_PER_PAGE));
        const lastUserPage = Math.max(1, Math.ceil(userTotalItems / ITEMS_PER_PAGE));
        
        const mostViewsRecipeDoc = await Recipe.aggregate([
            {
              $match: {
                type: "public"
              }
            },
            {
              $lookup: {
                from: 'users',
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
                'author.role': { $ne: 'system' },
                'author.status': 'active'

              }
            },
            {
              $sort: {
                'views.count': -1
              }
            },
            {
              $project: {
                title: 1,
                category: 1,
                description: 1,
                featureImage: 1,
                'author._id' : 1,
                'author.username': 1,
                'author.userImage': 1,
                'author.role': 1,
                'preparation.duration': 1,
                ratings: 1
              }
            },
            {
              $limit: 1
            }
          ]);
          
        const mostViewsRecipe = mostViewsRecipeDoc.length ? mostViewsRecipeDoc[0] : null;

        const currentDate = new Date(); // Get the current date

        // Find the recipe where showDate is greater than or equal to the current date
        const currentRecipe = await Recipe.findOne({ 
            shownDate: { $gte: currentDate } 
        });

        res.render("default/new-explorer", {
            path: "/pronadji",
            pageTitle: "Kuvajmo Zajedno",
            pageDescription: "Pronađite nove recept, knjige i korisnike, sve na jednom mestu. Pratite šta je najpopularnije i najtrežanije! Upoznajte nove ukuse i upustitese u avanturu kuvanja sa nama!",
            pageKeyWords: "Kuvajmo Zajedno, Pronađi, Recepti, Knjige, Zajednica, Prodaja, Diskusija, Zabava",
            recipes: recipes,
            books: books,
            users: users,
            activeRecipe: activeRecipe,
            activeBook: activeBook,
            activeUser: activeUser,
            currentRecipePage: recipePage,
            hasNextRecipePage: ITEMS_PER_PAGE * recipePage < recipeTotalItems,
            hasPreviousRecipePage: recipePage > 1,
            nextRecipePage: recipePage + 1,
            previousRecipePage: recipePage - 1,
            lastRecipePage: lastRecipePage,
            currentBookPage: bookPage,
            hasNextBookPage: ITEMS_PER_PAGE * bookPage < bookTotalItems,
            hasPreviousBookPage: bookPage > 1,
            nextBookPage: bookPage + 1,
            previousBookPage: bookPage - 1,
            lastBookPage: lastBookPage,
            currentUserPage: userPage,
            hasNextUserPage: ITEMS_PER_PAGE * userPage < userTotalItems,
            hasPreviousUserPage: userPage > 1,
            nextUserPage: userPage + 1,
            previousUserPage: userPage - 1,
            lastUserPage: lastUserPage,
            mostViewsRecipe: mostViewsRecipe,
            categories: uniqueCategories,
            searchCategory: searchCategory,
            searchCond: searchCond,
            recipeOfTheDay: currentRecipe
        });
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};


exports.getTermsAndCondtions = ( req, res, next ) => {
    try {
        return res.render('default/terms-and-conditions', {
            path: '/uslovi-koriscenja',
            pageTitle: "Uslovi Korišćenja",
            pageDescription: "Pročitajte naše uslove korišćenja i pravila ponašanja, sve na jednom mestu.",
            pageKeyWords: "uslovi korišćenja, pravila ponašanja, mere, kazne"
        })
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getPrivacyPolicy = ( req, res, next ) => {
    try {
        return res.render('default/privacy-policy', {
            path: '/politika-privatnosti',
            pageTitle: "Politika Privatnosti",
            pageDescription: "Pročitajte našu politiku privatnosti, šta i kako čuvamo i koristimo vaše podatke, sve na jednom mestu!",
            pageKeyWords: "politika privatnosti, podaci, zaštita, prava"
        })
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getAbout = ( req, res, next ) => {
    try {
        return res.render('default/about', {
            path: '/o-nama',
            pageTitle: "O Nama",
            pageDescription: "Upoznajte nas, šta mi to radimo, koja je naša vizija, misija, cilj..",
            pageKeyWords: "o nama, misija, vizija, cilj"
        });
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getImages = async (req, res, next) => {
    try {
        const imagePath = req.params.imagePath;
        const localImagePath = path.join(__dirname, '..', 'images', imagePath);
        fs.access(localImagePath, fs.constants.F_OK, (err) => {
            if (err) {
                const error = new Error("File not found");
                error.httpStatusCode = 404;
                return next(error);
            }

            const imageStream = fs.createReadStream(localImagePath);
            imageStream.on('error', (err) => {
                const error = new Error("Error reading the file");
                error.httpStatusCode = 500;
                return next(error);
            });
            imageStream.pipe(res);
        });
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!" + err);
        error.httpStatusCode = 500;
        return next(error);
    }
};

const generateSignedUrl = (publicId) => {
    const timestamp = Math.floor(Date.now() / 1000); // Current timestamp
    const expirationTime = timestamp + 60;

    const signedUrl = cloudinary.utils.private_download_url(publicId, 'jpg', {
        type: 'authenticated',
        expires_at: expirationTime,
      });
      
    return signedUrl;
};

exports.getClodinaryImages = async (req, res, next) => {
    try {
        const cloudName = cloudinary.config().cloud_name;
  
        const imagePath = req.params.imagePath;

        const publicUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_1000,h_1000,q_auto:good/${'uploads/' + imagePath}`;

        const isPublicAccessible = await checkPublicUrl(publicUrl);
      
        if (isPublicAccessible) {
          return res.redirect(publicUrl);
        } else {

            const cloudinaryImagePath = generateSignedUrl("uploads/" + imagePath);
            return res.redirect(cloudinaryImagePath);
        }
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

const checkPublicUrl = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

exports.getLeandingPage = (req, res, next) => {
    try {
        const name = req.params.name || "Korisniče";

        const last = name.slice(-1);
        const listOfNames = [
            "Mika",
            "Luka",
            "Vanja",
            "Sava",
            "Vuka",
            "Srđa",
            "Ilija",
            "Matija",
            "Stoja",
            "Nikola",
            "Nemanja",
        ]
        let isFemale;
        let sex = "Dragi";
        if (last === "a") {
            isFemale = true;
            sex = "Draga"
        } 
        
        if (listOfNames.includes(name)) {
            isFemale = false;
            sex = "Dragi"
        }

        return res.render('default/leanding-page', {
            path: '/pozivnica',
            pageTitle: "Pozivnica",
            pageDescription: `${sex} ${name}, pozivamo Vas da postanete deo naše zajednice, sačuvajte, delite, kupujte recepte i knjige, zabavite se i pomozite nam da budemo još bolji!`,
            pageKeyWords: "pozivnica, registracija, recepti, knjige",
            name: name,
            isFemale: isFemale
        })
    } catch (err) {
        const error = new Error("Desila se nepredviđena greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
};

exports.getEvents = async (req, res, next) => {
    try {
        currentDate = Date.now();
        const currentEvents = await Event.find({
            $and: [
              { endDate: { $gt: currentDate } }, // endDate veći od trenutnog datuma
              { startDate: { $lt: currentDate } } // startDate manji od trenutnog datuma
            ]
          })
            .select("title startDate endDate image type cost");
        const pastEvents = await Event.find({ endDate: {$lt: currentDate} })
            .select("title startDate endDate image type cost");
        const upcommingEvents = await Event.find({ startDate: {$gt: currentDate } })
            .select("title startDate endDate image type cost");

        let activeCurrent, activeFuture;
        if (currentEvents.length < 1 && upcommingEvents) {
            activeFuture = 'active';
        } else {
            activeCurrent = 'active';
        }
        return res.status(200).render("default/events", {
            path: "/default/events",
            pageTitle: "Događaji",
            pageDescription: "",
            pageKeyWords: "",
            currentEvents: currentEvents,
            pastEvents: pastEvents,
            upcommingEvents: upcommingEvents,
            activeCurrent: activeCurrent,
            activeFuture: activeFuture,
            activePast: undefined
        });
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}


exports.getEventById = (req, res, next) => {
    try {
        let eventStatus;
        let activeEnroll, activeParticipant, activeRecipes;
        activeEnroll = "active";

        let loggedUser = req.session.user;
        const eventId = req.params.eventId;
        const event = Event.findById(eventId)
            .then(event => {
                if (event.status === 'progress') {
                    eventStatus = true;
                } else {
                    eventStatus = false;
                }

                const recipes = [];
                let alredyEnrolled, haveRecipe;
                if (loggedUser) {
                    const cond = event.participants.some(participant => participant.userId.equals(loggedUser._id));
                    if (cond) {
                        alredyEnrolled = true;
                        activeEnroll = undefined;
                        activeRecipes = 'active';
                    }

                    const cond2 = event.content.some(content => content.author.userId.equals(loggedUser._id));
                    if (cond2) {
                        haveRecipe = true;
                    }
                    const user = User.findById(loggedUser._id)
                        .select("userRecipes")
                        .populate("userRecipes.recipeId", "category title type")
                        .then(user => {
                            user.userRecipes.forEach(recipe => {
                                const cond3 = recipe.recipeId.category.some(c => c === event.category);
                                if (cond3 && recipe.recipeId.type === "public") {
                                    recipes.push(recipe.recipeId);
                                }
                            })
                        })
                        .then(() => {
                            return res.render('default/event-details', {
                                path: "/default/event-details",
                                pageTitle: event.title,
                                pageDescription: event.description,
                                pageKeyWords: "",
                                event: event,
                                loggedUser: loggedUser,
                                status: eventStatus,
                                alredyEnrolled: alredyEnrolled,
                                haveRecipe: haveRecipe,
                                recipes: recipes,
                                activeEnroll: activeEnroll,
                                activeParticipant: activeParticipant,
                                activeRecipes: activeRecipes
                            })
                        })
                } else {
                    return res.render('default/event-details', {
                        path: "/default/event-details",
                        pageTitle: event.title,
                        pageDescription: event.description,
                        pageKeyWords: "",
                        event: event,
                        loggedUser: loggedUser,
                        status: eventStatus,
                        alredyEnrolled: alredyEnrolled,
                        haveRecipe: haveRecipe,
                        recipes: recipes,
                        activeEnroll: activeEnroll,
                        activeParticipant: activeParticipant,
                        activeRecipes: activeRecipes
                    })
                }
            })
    } catch (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    }
}
