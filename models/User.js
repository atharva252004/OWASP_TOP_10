const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  username: String,
  firstname: String,
  lastname: String,
  email: String,
  phone: Number,
  password: String,
});
module.exports = mongoose.model('users', UserSchema);
