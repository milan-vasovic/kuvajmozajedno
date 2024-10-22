// Import nesecery things
require("dotenv").config();
const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoDbStore = require("connect-mongodb-session")(session);
const { csrfSync } = require("csrf-sync");
const helmet = require("helmet");
const compression = require("compression");

const mongoose = require("mongoose");
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@recipes-book.aokhsfj.mongodb.net/${process.env.MONGO_DEFAULT_DB}`;

const flash = require("connect-flash");

const upload = require("./middleware/multerConfig");
const schedule = require("./util/scheduler");

// Import models

const User = require("./models/user");

// Intialize app
const app = express();
const store = new MongoDbStore({
  uri: MONGODB_URI,
  collextion: "sessions",
});

// Set csrf protection
const { csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) => req.body["CSRFToken"],
});

// Set ejs as view engine
app.set("view engine", "ejs");
app.set("views", "views");

// Import routes
const defaultRoutes = require("./routes/default");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const systemRoutes = require("./routes/system");
const forumRoutes = require('./routes/forum');
const errorController = require("./controllers/error");

const fitnesDefaultRouters = require('./routes/fitness/default');
const gymRouters = require('./routes/fitness/gym');

const apiRecipes = require("./routes/api-recipes");
const Topic = require("./models/topic");
const Event = require('./models/event');

// app.use(helmet());
app.use(compression());

// Tell app that we are using express and where to find it
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(upload);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "images")));

// Create session in our app
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfSynchronisedProtection);
app.use(flash());

// Check if user is looged in if not set local value to guest
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  if (res.locals.isAuthenticated) {
    res.locals.role = req.session.user.role;
  } else {
    res.locals.role = "guest";
  }
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    req.session.guest = true;
    return next();
  }
  User.findById(req.session.user._id)
    .select("_id role status username userImage blocking blockedBy")
    .then((user) => {
      if (!user) {
        req.session.guest = true;
        return next();
      }
      req.session.guest = false;
      req.session.user = user;
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
});


// Set routes to app
app.use(userRoutes);
app.use("/admin", adminRoutes);
app.use("/system", systemRoutes);
app.use(defaultRoutes);
app.use(authRoutes);
app.use('/zajednica', forumRoutes);

app.use('/fitness-family', gymRouters);
app.use('/fitness-family', fitnesDefaultRouters);

app.use("/api/", apiRecipes);

app.use("/500", errorController.get500);
app.use(errorController.get404);



app.use((error, req, res, next) => {
  const httpStatusCode = error.httpStatusCode ? error.httpStatusCode : 500;

  res.status(httpStatusCode).render("errors/500", {
    pageTitle: "Error!",
    path: "/500",
    pageDescription: "",
    pageKeyWords: "",
    errorMsg: error,
    isAuthenticated: !!req.session?.isLoggedIn,
    user: req.session.user,
    role: req.session.user ? req.session.user.role : "guest",
    csrfToken: req.csrfToken(),
  });
});



// Connect app to database and run it
mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log(err);
  });
