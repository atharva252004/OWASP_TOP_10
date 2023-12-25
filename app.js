// Node Modules
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('node:fs');
const path = require('node:path');

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('./models/User');
const Complaint = require('./models/Complaint');

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
const morgan = require('morgan')('combined', { stream: accessLogStream })
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Initialising Express
const app = express();
// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const url =
  'mongodb+srv://root:pass@cluster0.ijtmeag.mongodb.net/testdb?retryWrites=true&w=majority';
const placeholderImage =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/1022px-Placeholder_view_vector.svg.png?20220519031949';

// connecting to database
mongoose.connect(url);
app.listen(8080);

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/views/pages'));
app.use(morgan)

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

// isAdmin middleware
const isAdmin = async (req, res, next) => {
  if (req.user.username !== 'admin') {
    logger.error(`User {username: ${req.user.username}} tried to access admin route. Forbidden`)
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

app.get('/', function(req, res) {
  return res.redirect('/home');
});

app.get('/signup', function(req, res) {
  res.sendFile(__dirname + '/views/pages/signup.html');
});

app.get('/home', isAuthenticated, function(req, res) {
  res.sendFile(__dirname + '/views/pages/home.html');
});

app.post('/signup', async (req, res) => {
  const { username, password, firstname, lastname, email, phone } = req.body;

  const existingUser = await User.findOne({ username: username });
  if (existingUser) {
    logger.info(`User {username: ${username}} already exists. Redirecting to /signup`)
    return res.status(401).json({ message: 'User already exists!' });
  }

  await User.create({
    username,
    hash: await bcrypt.hash(password, 10),
    firstname,
    lastname,
    email,
    phone,
  });
  res.cookie('username', username);
  res.redirect('/home');
});

app.get('/login', (req, res) => {
  //res.render("login");
  res.sendFile(__dirname + '/views/pages/login.html');
});

app.post(
  '/login',
  async function(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(401).
        json({ message: 'Incorrect username or password' });
    }

    const existingUser = await User.findOne({ username: username }).
      select('+hash');
    if (!existingUser) {
      logger.info(`User {username: ${username}} not found. Redirecting to /login`)
      return res.status(401).json({ message: 'No user found!' });
    }

    // Authenticate user
    const match = await bcrypt.compare(password, existingUser.hash);

    if (!match) {
      logger.error(`User {username: ${username}} entered incorrect password. Redirecting to /login`)
      return res.status(401).json({ message: 'Incorrect password' });
    }

    res.cookie('username', username);
    res.redirect('/home');
  },
);

// Get complaints for given name
app.get('/my-complaints/', isAuthenticated, async function(req, res) {
  // Find data in users collection
  const complaints = await Complaint.find({
    username: req.user.username,
  });
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
  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

// Users Route
app.get('/users', isAuthenticated, isAdmin, async function(req, res) {
  // Find data in users collection
  const users = await User.find();
  // Show books page
  res.render('pages/users', { users });
});

app.get('/complaints', isAuthenticated, isAdmin, async function(req, res) {
  // Find data in users collection
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
  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

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
    await crimeDetails.save();
    res.redirect('/home');
  } catch (err) {
    logger.error(`Error during record insertion : ${err}`)
    console.error('Error during record insertion : ' + err);
  }
});
