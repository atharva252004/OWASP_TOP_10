// Node Modules
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const ejs = require('ejs');

const mongoose = require('mongoose');
const passport = require('passport');
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

// Configure passport-local to use user model for authentication
passport.serializeUser(User.serializeUser()); //session encoding
passport.deserializeUser(User.deserializeUser()); //session decoding
passport.use(User.createStrategy());

// Middleware
// Session
app.use(
  session({
    secret: 'super-secret-password', //decode or encode session
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/views/pages'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/pages/signup.html');
});

app.get('/home', function(req, res) {
  res.sendFile(__dirname + '/views/pages/home.html');
});

app.post('/signup', (req, res) => {
  User.register(
    new User({
      username: req.body.username,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      email: req.body.email,
      phone: req.body.phone,
    }),
    req.body.password,
    function(err, user) {
      if (err) {
        console.log(err);
        //res.render("register");
        res.sendFile(__dirname + '/views/pages/signup.html');
        return;
      }
      res.cookie('name', req.body.firstname + ' ' + req.body.lastname);
      passport.authenticate('local')(req, res, function() {
        res.redirect('/login');
        //res.sendFile(__dirname + "/views/pages/login.html");
      });
    },
  );
});

app.get('/login', (req, res) => {
  //res.render("login");
  res.sendFile(__dirname + '/views/pages/login.html');
});

app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/login',
  }),
  function(req, res) {},
);

// Users Route
app.get('/users', async function(req, res) {
  // Find data in users collection
  const users = await User.find();
  // Show books page
  res.render('pages/users', { users });
});

// Get complaints for given name
app.get('/my-complaints/', async function(req, res) {
  // Find data in users collection
  const complaints = await Complaint.find({
    firstname: req.cookies.name.split(' ')[0],
    lastname: req.cookies.name.split(' ')[1],
  });
  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

app.get('/complaints', async function(req, res) {
  // Find data in users collection
  const complaints = await Complaint.find();
  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

app.get('/complaints', async function(req, res) {
  // Find data in users collection
  const complaints = await Complaint.find();
  res.render('pages/complaints', {
    Complaints: complaints,
  });
});

app.post('/report', async function(req, res, next) {
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
