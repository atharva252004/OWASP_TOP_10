const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  email: String,
  date_time: String,
  type: String,
  location: String,
  description: String,
});
module.exports = mongoose.model('Complaint', ComplaintSchema);
