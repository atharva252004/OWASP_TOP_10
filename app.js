// Node Modules
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

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
const placeholderImage =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/1022px-Placeholder_view_vector.svg.png?20220519031949';

// connecting to database
mongoose.connect(url);
app.listen(8080);

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/views/pages'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/pages/signup.html');
});

app.get('/home', function(req, res) {
  res.sendFile(__dirname + '/views/pages/home.html');
});

app.post('/signup', async (req, res) => {
  const { username, password, firstname, lastname, email, phone } = req.body;

  const existingUser = await User.findOne({ username: username });
  if (existingUser) {
    return res.status(401).json({ message: 'User already exists!' });
  }

  await User.create({ username, password, firstname, lastname, email, phone });
  res.cookie('name', firstname + ' ' + lastname);
  res.redirect('/home');
});

app.get('/login', (req, res) => {
  //res.render("login");
  res.sendFile(__dirname + '/views/pages/login.html');
});

app.post('/login', async function(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(401).json({ message: 'Incorrect username or password' });
  }

  const existingUser = await User.findOne({ username: username }).select(
    '+password',
  );
  if (!existingUser) {
    return res.status(401).json({ message: 'No user found!' });
  }

  // Authenticate user
  if (existingUser.password !== password) {
    return res.status(401).json({ message: 'Incorrect password' });
  }

  res.cookie('name', existingUser.firstname + ' ' + existingUser.lastname);
  res.redirect('/home');
});

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

app.get('/complaints', async function(req, res) {
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

app.post('/report', async function(req, res) {
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
    // alert("User Added successfully")
    // res.sendFile(__dirname + "/views/pages/home.html");
  } catch (err) {
    console.error('Error during record insertion : ' + err);
  }
  // res.send('Data received:\n' + JSON.stringify(req.body));
});
