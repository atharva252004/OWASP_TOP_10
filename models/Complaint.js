const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  email: String,
  date_time: String,
  type: String,
  location: String,
  description: String,
  url: String,
  approved: Boolean,
});
module.exports = mongoose.model('Complaint', ComplaintSchema);
