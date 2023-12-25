// Node Modules
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const ejs = require('ejs');

const mongoose = require('mongoose');
const User = require('./models/User');
const Complaint = require('./models/Complaint');

// Initialising Express
const app = express();
// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const url =
  'mongodb+srv://root:pass@cluster0.ijtmeag.mongodb.net/testdb?retryWrites=true&w=majority';

// connecting to database
mongoose.connect(url);
app.listen(8080);

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/views/pages'));

const isAuthenticated = async (req, res, next) => {
  if (!req.cookies.username) {
    return res.redirect('/login');
  }

  const user = await User.findOne({ username: req.cookies.username });
  if (!user) {
    return res.redirect('/login');
  }

  req.user = user;
  next();
};

// isAdmin middleware
const isAdmin = async (req, res, next) => {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}

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
    return res.status(401).json({ message: 'User already exists!' });
  }

  await User.create({
    username: username,
    password: password,
    firstname: firstname,
    lastname: lastname,
    email: email,
    phone: phone,
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
      select('+password');
    if (!existingUser) {
      return res.status(401).json({ message: 'No user found!' });
    }

    // Authenticate user
    if (existingUser.password !== password) {
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
  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

app.post('/report', isAuthenticated, async function(req, res, next) {
  const crimeDetails = new Complaint({
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    date_time: req.body.date_time,
    type: req.body.type,
    location: req.body.location,
    description: req.body.description,
  });

  try {
    await crimeDetails.save();
    res.redirect('/home');
    // alert("User Added successfully")
    // res.sendFile(__dirname + "/views/pages/home.html");
  } catch (err) {
    console.error('Error during record insertion : ' + err);
  }
  // res.send('Data received:\n' + JSON.stringify(req.body));
});
