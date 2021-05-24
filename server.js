const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const passport = require("passport");
const client = require("./routes/api/client");
const lawyer = require("./routes/api/lawyer");
const admin = require("./routes/api/admin");
const fileupload = require('express-fileupload')
// const messages = require('./routes/api/messages');

const cors = require("cors");
const app = express();

app.use(express.static('public'));

const port = process.env.PORT || 5000;
const server = app.listen(port, () =>
  console.log(`Server running on port ${port}`)
);
const io = require("socket.io").listen(server);
// io.listen(server);

//DB Config
const db = require("./config/keys").mongoURI;

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Passport middleware
app.use(function (req, res, next) {
  req.io = io;
  next();
  },
  passport.initialize(),
  express.json(),
  fileupload());

app.use(cors());
//Connect to MongoDB
mongoose
  .connect(db, { useUnifiedTopology: true, useNewUrlParser: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
  
//Passport config
require("./config/passport")(passport);

app.set("view engine", "ejs");

app.use("/api/client", client);
app.use("/api/lawyer", lawyer);
app.use("/api/lawyer", admin);
