const express = require("express");
const router = express.Router();
const gravatar = require("gravatar");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const keys = require("../../config/keys");
const passport = require("passport");
const crypto = require("crypto");

//Load Input Validation
const validateRegisterInput = require("../../validation/userRegister");
//Load Input Validation
const validateLoginInput = require("../../validation/login");
const validateChangePassword = require("../../validation/new.password");

const Lawyer = require("../../models/lawyer.model");

router.post(
  "/activate-lawyer",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let lawyer_id = req.body.lawyer_id;

    if (req.user.role == "admin") {
      Lawyer.findOne({ _id: lawyer_id }).then((lawyer) => {
        let updated_fields = {
          status: "active",
        };

        Lawyer.findOneAndUpdate({ _id: lawyer._id }, updated_fields)
          .then(() => res.send("Lawyer Activation Successful"))
          .catch((err) => console.log(err));
      });
    }
  }
);

router.post(
  "/delete-lawyer",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Lawyer.findOneAndDelete({ _id: req.body.lawyer_id })
      .then(() => res.send("success"))
      .catch((err) => console.log(err));
  }
);

router.post(
  "/delete-client",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Client.findOneAndDelete({ _id: req.body.client_id })
      .then(() => res.send("success"))
      .catch((err) => console.log(err));
  }
);

router.get(
  "/all-registered-lawyers",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    if (req.user.role === "admin") {
      Lawyer.find({ role: "lawyer" })
        .then((lawyers) => {
          res.json(lawyers);
        })
        .catch((err) => console.log(err));
    }
  }
);

module.exports = router;
