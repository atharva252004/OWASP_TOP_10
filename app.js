// Node Modules
const express = require('express'); // Importing Express module
const bodyParser = require('body-parser'); // Importing body-parser module
const cookieParser = require('cookie-parser'); // Importing cookie-parser module
const fs = require('node:fs'); // Importing fs module
const path = require('node:path'); // Importing path module

const bcrypt = require('bcrypt'); // Importing bcrypt module
const mongoose = require('mongoose'); // Importing mongoose module
const User = require('./models/User'); // Importing User model
const Complaint = require('./models/Complaint'); // Importing Complaint model

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' }) // Creating a write stream for access.log file
const morgan = require('morgan')('combined', { stream: accessLogStream }) // Configuring morgan middleware

const winston = require('winston'); // Importing winston module

const logger = winston.createLogger({ // Creating a logger instance
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Initialising Express
const app = express(); // Creating an Express application
// set the view engine to ejs
app.set('view engine', 'ejs'); // Setting the view engine to ejs

app.use(cookieParser()); // Using cookie-parser middleware
app.use(bodyParser.json()); // Using body-parser middleware for parsing JSON
app.use(bodyParser.urlencoded({ extended: true })); // Using body-parser middleware for parsing URL-encoded bodies

const url =
  'mongodb+srv://root:pass@cluster0.ijtmeag.mongodb.net/testdb?retryWrites=true&w=majority'; // MongoDB connection URL
const placeholderImage =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/1022px-Placeholder_view_vector.svg.png?20220519031949'; // Placeholder image URL

// connecting to database
mongoose.connect(url); // Connecting to MongoDB database
app.listen(8080); // Starting the server on port 8080

// Middlewares
app.use(bodyParser.urlencoded({ extended: true })); // Using body-parser middleware for parsing URL-encoded bodies
app.use(express.static(__dirname + '/views/pages')); // Serving static files from '/views/pages' directory
app.use(morgan); // Using morgan middleware for logging

/**
 * Middleware to check if the user is authenticated.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {void}
 */
const isAuthenticated = async (req, res, next) => {
  if (!req.cookies.username) {
    logger.info(`User not logged in. Redirecting to /login`)
    return res.redirect('/login');
  }

  const user = await User.findOne({ username: req.cookies.username });
  if (!user) {
    logger.info(`User {username: ${req.cookies.username}} not found. Redirecting to /login`)
    return res.redirect('/login');
  }

  req.user = user;
  next();
};


/** 
  * Middleware to check if the user is admin.
  * @param {Object} req - The request object.
  * @param {Object} res - The response object.
  * @param {Function} next - The next middleware function.
  * @returns {void}
  */
const isAdmin = async (req, res, next) => {
  if (req.user.username !== 'admin') {
    logger.error(`User {username: ${req.user.username}} tried to access admin route. Forbidden`)
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};


// Redirect root URL to /home
app.get('/', function(req, res) {
  return res.redirect('/home');
});

// Serve signup.html file
app.get('/signup', function(req, res) {
  res.sendFile(__dirname + '/views/pages/signup.html');
});

// Serve home.html file only if user is authenticated
app.get('/home', isAuthenticated, function(req, res) {
  res.sendFile(__dirname + '/views/pages/home.html');
});

// Handle signup form submission
app.post('/signup', async (req, res) => {
  const { username, password, firstname, lastname, email, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ username: username });
  if (existingUser) {
    logger.info(`User {username: ${username}} already exists. Redirecting to /signup`)
    return res.status(401).json({ message: 'User already exists!' });
  }

  // Create new user
  await User.create({
    username,
    hash: await bcrypt.hash(password, 10),
    firstname,
    lastname,
    email,
    phone,
  });

  // Set cookie and redirect to home
  res.cookie('username', username);
  res.redirect('/home');
});

// Serve login.html file
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/views/pages/login.html');
});

// Handle login form submission
app.post('/login', async function(req, res) {
  const { username, password } = req.body;

  // If username or password is not provided, return error  
  if (!username || !password) {
    return res.status(401).json({ message: 'Incorrect username or password' });
  }

  // Find user by username
  const existingUser = await User.findOne({ username: username }).select('+hash');
  if (!existingUser) {
    logger.info(`User {username: ${username}} not found. Redirecting to /login`)
    return res.status(401).json({ message: 'No user found!' });
  }

  // Authenticate user
  if (!await bcrypt.compare(password, existingUser.hash)) {
    logger.error(`User {username: ${username}} entered incorrect password. Redirecting to /login`)
    return res.status(401).json({ message: 'Incorrect password' });
  }

  // Set cookie and redirect to home
  res.cookie('username', username);
  res.redirect('/home');
});

// Get complaints for the authenticated user
app.get('/my-complaints/', isAuthenticated, async function(req, res) {
  // Find complaints for the user
  const complaints = await Complaint.find({
    username: req.user.username,
  });

  // Fetch image title for each image
  for (let i = 0; i < complaints.length; i++) {

    // Convert mongoose model to plain object
    complaints[i] = complaints[i].toObject();

    // Set placeholder image if url is not provided
    complaints[i].url ??= placeholderImage;

    // Fetch image title
    complaints[i].imageName = await fetch(complaints[i].url)
      .then((res) => res.text())
      .then((text) => {
        // Regex to extract title from HTML
        const re = /<title>(.*?)<\/title>/;
        const found = text.match(re);
        return (found && found[1]) || 'Image';
      });
  }

  // Wait for all promises to resolve
  await Promise.allSettled(complaints.map((complaint) => complaint.imageName));

  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

// Get all users (admin only)
app.get('/users', isAuthenticated, isAdmin, async function(req, res) {
  // Find all users
  const users = await User.find();
  res.render('pages/users', { users });
});

// Get all complaints (admin only)
app.get('/complaints', isAuthenticated, isAdmin, async function(req, res) {
  // Find all complaints
  const complaints = await Complaint.find();

  // Fetch image title for each image
  for (let i = 0; i < complaints.length; i++) {

    // Convert mongoose model to plain object
    complaints[i] = complaints[i].toObject();

    // Set placeholder image if url is not provided
    complaints[i].url ??= placeholderImage;

    // Fetch image title
    complaints[i].imageName = await fetch(complaints[i].url)
      .then((res) => res.text())
      .then((text) => {
        // Regex to extract title from HTML
        const re = /<title>(.*?)<\/title>/;
        const found = text.match(re);
        return (found && found[1]) || 'Image';
      });
  }

  // Wait for all promises to resolve
  await Promise.allSettled(complaints.map((complaint) => complaint.imageName));

  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

// Handle report form submission
app.post('/report', isAuthenticated, async function(req, res) {
  const {
    firstname,
    lastname,
    email,
    date_time,
    type,
    location,
    description,
    url,
  } = req.body;
  const crimeDetails = new Complaint({
    firstname,
    lastname,
    email,
    date_time,
    type,
    location,
    description,
    url,
  });

  try {

    // Save complaint to database
    await crimeDetails.save();
    res.redirect('/home');
  } catch (err) {
    logger.error(`Error during record insertion : ${err}`)
    console.error('Error during record insertion : ' + err);
  }
});

app.get('/report-approval', async function(req, res) {
  const complaints = await Complaint.find();

  for (let i = 0; i < complaints.length; i++) {
    complaints[i] = complaints[i].toObject();
    complaints[i].url ??= placeholderImage;
    complaints[i].imageName = await fetch(complaints[i].url).
      then((res) => res.text()).
      then((text) => {
        const re = /<title>(.*?)<\/title>/;
        const found = text.match(re);
        return (found && found[1]) || 'Image';
      });
  }

  await Promise.allSettled(complaints.map((complaint) => complaint.imageName));
  res.render('pages/report_approval', {
    Complaints: complaints,
  });
});

app.patch('/approve/:id', async function(req, res) {
  // find one by id and update to add approved true
  try {
    console.log(await Complaint.findByIdAndUpdate(req.params.id, { approved: 'true' }, { new: true }));
  } catch (e) {
    console.error(e);
  }

  res.redirect('/report-approval');
});
