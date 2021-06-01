const express = require("express");
const router = express.Router();
const gravatar = require("gravatar");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const keys = require("../../config/keys");
const passport = require("passport");
const crypto = require("crypto");
const mongoose = require("mongoose");
const moment = require("moment");

//Load Input Validation
const validateRegisterInput = require("../../validation/userRegister");
//Load Input Validation
const validateLoginInput = require("../../validation/login");
const validateChangePassword = require("../../validation/new.password");

const Lawyer = require("../../models/lawyer.model");
const Education = require("../../models/education.model");
const Experience = require("../../models/experience.model");
const Profile = require("../../models/profile.model");
const Customer = require("../../models/customer.model");
const Client = require("../../models/client.model");
const Contract = require("../../models/contract.model");
const Conversation = require("../../models/conversation.model");
const Message = require("../../models/message.model");
const Receipt = require("../../models/receipt.model");

const {
  createStripeCustomer,
  cancelSubscription,
  subscribeCustomer,
  createPaymentCardToken,
  attachPaymentSource,
  getCustomerByID,
  updatePaymentSource,
} = require("../../controller/paymentController");

//method that adds specified number og days for free trial days to(for subscribtion)(nb)
Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
};

router.post("/register", (req, res) => {
  const { errors } = validateLoginInput(req.body);

  const first_name = req.body.first_name;
  const last_name = req.body.last_name;
  const password = req.body.password;
  const email = req.body.email;

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) throw err;

      Client.findOne({ email: email }).then((user) => {
        if (user) {
          errors.error = "User already added";
          res.status(400).json(errors);
        } else {
          var nowDate = new Date(); //used for the purpose of subscribtion expiration
          var now = Date.now();
          var free_trial_period = 14; //the trial period is random number

          let newClient = new Client({
            first_name: first_name,
            last_name: last_name,
            email: email,
            password: hash,
            is_subscribed: false,
            registerd_date: now, //(nb)
            expiry_date: nowDate.addDays(free_trial_period), //(nb)
          });

          newClient
            .save()
            .then((newclient) => res.send("Successfully Registered."))
            .catch((err) => console.log(err));
        }
      });
    });
  });
});

//to show how many trial period is left
router.get(
  "/trial-period",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Client.findOne({ _id: req.user.id }, (err, cmpny) => {
      if (cmpny) {
        var val1 = moment(cmpny.expiry_date, "YYYY/M/D");
        // console.log("val1",val1);
        var val2 = moment();
        //  console.log("val2",val2);
        var days_left = val1.diff(val2, "days");
        //  console.log(days_left);
        if (days_left < 0) {
          res.send("trial period is Over! please subscribe");
        } else {
          res.status(200).send({ days_left });
        }
      } else console.log("not found");
    });
  }
);

router.get(
  "/current",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Payment.findOne({ client: req.user }).then((payment) => {
      if (payment) {
        res.json({
          id: req.user._id,
          email: req.user.email,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          role: req.user.role,
          balance: req.user.balance,
          has_card: payment.has_card,
          is_subscribed: req.user.is_subscribed,
        });
      } else {
        res.json({
          id: req.user._id,
          email: req.user.email,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          role: req.user.role,
          has_card: false,
          is_subscribed: req.user.is_subscribed,
        });
      }
    });
  }
);

//checks expiration(nb)
function check_expiration(client_email, callback) {
  Client.findOne({ email: client_email }, (err, clnt) => {
    if (!err) {
      //if no error
      if (!clnt.is_subscribed) {
        //if company not subscribed
        if (clnt.expiry_date < Date.now()) {
          //if the expiry date passed
          callback(true);
        } else callback(false);
      } else {
        callback(false);
      }
    }
  });
}

router.post("/login", (req, res) => {
  const { errors, isValid } = validateLoginInput(req.body);

  //Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const password = req.body.password;
  //Find company by email
  Client.findOne({ email })
    .then((user) => {
      //Check for user
      if (!user) {
        errors.error = "Invalid credential";
        res.status(400).json(errors);
      }

      //Check for password
      bcrypt
        .compare(password, user.password)
        .then((isMatch) => {
          if (isMatch) {
            //User Matched
            //check  if trial period has expired
            check_expiration(user.email, function (result) {
              if (result) {
                //expired
                errors.error = "Your free trial session has expired!";
                return res.status(400).json(errors);
              } else {
                const payload = { id: user.id, name: user.email }; //Create JWT

                //Sign Token
                jwt.sign(
                  payload,
                  keys.secretOrKey,
                  { expiresIn: 3600 },
                  (err, token) => {
                    res.json({
                      success: true,
                      user: user,
                      token: "Bearer " + token,
                    });
                  }
                );
              }
            });
          } else {
            errors.error = "Invalid credential";
            res.status(400).json(errors);
          }
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));
});

// when company admin forgets password
router.post("/forgot-password", (req, res) => {
  let userEmail = req.body.userEmail;
  if (req.body.email === "") {
    res.status(400).json({
      message: "Email can not be empty",
      success: false,
    });
  }
  Client.findOne({ email: userEmail })
    .then(async (user) => {
      if (user === null) {
        res.status(400).json({
          message: "Email doesn't exist!",
          success: false,
        });
      } else {
        const token = jwt.sign(
          { userEmail },
          "process.env.JWT_PASSWORD_RESET",
          { expiresIn: "365d" }
        );

        let updatedFields = {
          resetPasswordToken: token,
        };

        Client.findOneAndUpdate({ email: userEmail }, updatedFields)
          .then((user) => {
            const msg = {
              to: userEmail,
              from: "infos@claimyourrights.ch",
              subject: "Forgot password link from Claim Your Rights",
              html: `<div>
                  <span>
                    Hello, this link is used to reset your password. Please
                    follow this link to begin the process.
                  </span>
                  <a clicktracking="off" href=http://env-4469307.jcloud-ver-jpc.ik-server.com/#/client/verify-password-reset/${token}>
                    Reset Password
                  </a>
                </div>`,
            };
            sgMail
              .send(msg)
              .then(() => {
                res.status(200).json({
                  message: "Email sent successfully",
                  success: true,
                });
              })
              .catch((err) => console.log("Error while sending an email", err));
          })
          .catch((err) => {
            res.status(400).json({
              message: err.response.data,
              success: false,
            });
          });
      }
    })
    .catch((err) => console.log(err));
});

// verify reset password from email
router.post("/verify-password-reset/:token", (req, res) => {
  // const { errors } = validateRegisterInput(req.body);
  let token = req.params.token;

  if (token) {
    jwt.verify(
      token,
      "process.env.JWT_PASSWORD_RESET",
      function (err, decoded) {
        if (err) {
          console.log("JWT VERIFY IN ACCOUNT ACTIVATION ERROR", err);
          // return res.redirect("http://localhost:5000/login/error");
        }
      }
    );

    Client.findOne({ resetPasswordToken: token })
      .then((user) => {
        if (user) {
          return res.send("valid");
        } else {
          res.send("invalid");
          return res.status(400);
        }
      })
      .catch((err) => console.log(err));
  }
});

// finish resetting password
router.post("/reset-password", (req, res) => {
  let password = req.body.password;
  let token = req.body.token;

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) throw err;
      let updatedFields = {
        password: hash,
        resetPasswordToken: "",
        resetPasswordExpires: null,
      };
      Client.findOneAndUpdate({ resetPasswordToken: token }, updatedFields)
        .then((user) => {
          return res.json(user);
        })
        .catch((err) => {
          return res.json(err);
        });
    });
  });
});

router.get("/lawyers", (req, res) => {
  let data = [];
  let info = {};
  let counter = [];

  Lawyer.find({ status: "active", profile_built: true, role: "lawyer" })
    .then((lawyers) => {
      if (lawyers) {
        lawyers.forEach((lawyer) => {
          Profile.findOne({ lawyer: lawyer })
            .then((profile) => {
              Lawyer.findOne({ _id: profile.lawyer }).then((law) => {
                info.lawyer = law;
                info.legal_fields = profile.legal_fields;
                data = [...data, info];
                counter = [...counter, lawyer];
                info = {};
                if (counter.length === lawyers.length) {
                  res.send(data);
                }
              });
              // console.log(data);
            })
            .catch((err) => console.log(err));
        });
      } else {
        res.send([]);
      }
    })
    .catch((err) => console.log(err));
});

router.post(
  "/lawyer-profile",
  // passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    let lawyer_id = req.body.lawyer_id;
    let return_data = [];
    let obj = {};
    let counter = [];

    Lawyer.findById(lawyer_id)
      .then((lawyer) => {
        Profile.findOne({ lawyer: lawyer })
          .then((profile) => {
            if (profile) {
              obj.profile = profile;

              Education.find({ lawyer: lawyer })
                .then((educations) => {
                  if (educations.length != 0) {
                    obj.education = educations;
                  }
                  Experience.find({ lawyer: lawyer })
                    .then((experiences) => {
                      if (experiences.length) {
                        obj.experience = experiences;
                      }

                      return_data = [...return_data, obj];

                      res.send(obj["profile"]);
                    })
                    .catch((err) => console.log(err));
                })
                .catch((err) => console.log(err));
            }
          })
          .catch((err) => console.log(err));
      })
      .catch((err) => console.log(err));
  }
);

router.post("/get-search-results", (req, res) => {
  let location = req.body.location;
  let legal_field = req.body.legal_field;
  let service = req.body.service;
  let language = req.body.language;
  let temp = [];

  let info = {};
  let data = [];
  Profile.find()
    .then((profiles) => {
      profiles.forEach((profile) => {
        // SINGLE FIELDS
        if (
          service != null &&
          legal_field == null &&
          location == null &&
          language == null
        ) {
          let x = false;
          profile.services.forEach((proser) => {
            if (service === proser) {
              x = true;
            }

            if (x) {
              Lawyer.findOne({ _id: profile.lawyer, status: "active" })
                .then((lawyer) => {
                  if (lawyer) {
                    temp = [...temp, 1];
                    info.lawyer = lawyer;
                    info.legal_fields = profile.legal_fields;
                    data = [...data, info];
                    info = {};
                    if (temp.length === profiles.length) {
                      res.send(data);
                    }
                  } else {
                    temp = [...temp, 1];
                    if (temp.length === profiles.length) {
                      res.send(data);
                    }
                  }
                })
                .catch((err) => console.log(err));
            } else {
              temp = [...temp, 1];
              if (temp.length === profiles.length) {
                res.send(data);
              }
            }
          });
        } else if (
          service == null &&
          legal_field != null &&
          location == null &&
          language == null
        ) {
          let x = false;
          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser) {
              x = true;
            }
          });

          if (x) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  info.lawyer = lawyer;
                  temp = [...temp, 1];
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  // console.log("temp ", temp.length);
                  // console.log("profiles ", profiles.length);
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service == null &&
          legal_field == null &&
          location != null &&
          language == null
        ) {
          let x = false;
          if (profile.location === location) {
            x = true;
          }

          if (x) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service == null &&
          legal_field == null &&
          location == null &&
          language != null
        ) {
          let x = false;
          profile.languages.forEach((proser) => {
            if (language === proser) {
              x = true;
            }
          });

          if (x) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        }

        // DOUBLE FIELDS
        else if (
          service != null &&
          legal_field == null &&
          location != null &&
          language == null
        ) {
          let x = false;
          profile.services.forEach((proser) => {
            if (service === proser && profile.location === location) {
              x = true;
            }

            if (x) {
              Lawyer.findOne({ _id: profile.lawyer, status: "active" })
                .then((lawyer) => {
                  if (lawyer) {
                    temp = [...temp, 1];
                    info.lawyer = lawyer;
                    info.legal_fields = profile.legal_fields;
                    data = [...data, info];
                    info = {};
                    if (temp.length === profiles.length) {
                      res.send(data);
                    }
                  } else {
                    temp = [...temp, 1];
                    if (temp.length === profiles.length) {
                      res.send(data);
                    }
                  }
                })
                .catch((err) => console.log(err));
            } else {
              temp = [...temp, 1];
              if (temp.length === profiles.length) {
                res.send(data);
              }
            }
          });
        } else if (
          service == null &&
          legal_field != null &&
          location != null &&
          language == null
        ) {
          let x = false;
          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser && profile.location === location) {
              x = true;
            }

            if (x) {
              Lawyer.findOne({ _id: profile.lawyer, status: "active" })
                .then((lawyer) => {
                  if (lawyer) {
                    temp = [...temp, 1];
                    info.lawyer = lawyer;
                    info.legal_fields = profile.legal_fields;
                    data = [...data, info];
                    info = {};
                    if (temp.length === profiles.length) {
                      res.send(data);
                    }
                  } else {
                    temp = [...temp, 1];
                    if (temp.length === profiles.length) {
                      res.send(data);
                    }
                  }
                })
                .catch((err) => console.log(err));
            } else {
              temp = [...temp, 1];
              if (temp.length === profiles.length) {
                res.send(data);
              }
            }
          });
        } else if (
          service != null &&
          legal_field == null &&
          location == null &&
          language != null
        ) {
          let x = false;
          let y = false;
          profile.languages.forEach((proser) => {
            if (language === proser) {
              x = true;
            }
          });
          profile.services.forEach((proser) => {
            if (service === proser) {
              y = true;
            }
          });

          if (x && y) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service == null &&
          legal_field != null &&
          location == null &&
          language != null
        ) {
          let x = false;
          let y = false;
          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser) {
              x = true;
            }
          });
          profile.languages.forEach((proser) => {
            if (language === proser) {
              y = true;
            }
          });

          if (x && y) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service == null &&
          legal_field == null &&
          location != null &&
          language != null
        ) {
          let x = false;
          let y = false;
          profile.location.forEach((proser) => {
            if (location === proser) {
              x = true;
            }
          });
          profile.languages.forEach((proser) => {
            if (language === proser) {
              y = true;
            }
          });

          if (x && y) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        }

        // TRIPE FIELDS
        else if (
          service != null &&
          legal_field != null &&
          location != null &&
          language == null
        ) {
          let x = false;
          let y = false;
          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser) {
              x = true;
            }
          });
          profile.services.forEach((proser) => {
            if (service === proser) {
              y = true;
            }
          });

          if (x && y && profile.location === location) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service != null &&
          legal_field != null &&
          location == null &&
          language != null
        ) {
          let x = false;
          let y = false;
          let z = false;
          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser) {
              x = true;
            }
          });
          profile.services.forEach((proser) => {
            if (service === proser) {
              y = true;
            }
          });
          profile.languages.forEach((proser) => {
            if (language === proser) {
              z = true;
            }
          });

          if (x && y && z) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service != null &&
          legal_field == null &&
          location != null &&
          language != null
        ) {
          let x = false;
          let y = false;
          let z = false;

          profile.services.forEach((proser) => {
            if (service === proser) {
              y = true;
            }
          });
          profile.languages.forEach((proser) => {
            if (language === proser) {
              z = true;
            }
          });

          if (y && z && profile.location === location) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        } else if (
          service == null &&
          legal_field != null &&
          location != null &&
          language != null
        ) {
          let x = false;
          let y = false;
          let z = false;

          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser) {
              y = true;
            }
          });
          profile.languages.forEach((proser) => {
            if (language === proser) {
              z = true;
            }
          });

          if (y && z && profile.location === location) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        }

        // Quadriple Algorithm
        else if (
          service != null &&
          legal_field != null &&
          location != null &&
          language != null
        ) {
          let x = false;
          let y = false;
          let z = false;
          profile.legal_fields.forEach((proser) => {
            if (legal_field === proser) {
              x = true;
            }
          });
          profile.services.forEach((proser) => {
            if (service === proser) {
              y = true;
            }
          });
          profile.languages.forEach((proser) => {
            if (language === proser) {
              z = true;
            }
          });

          if (x && y && z && profile.location === location) {
            Lawyer.findOne({ _id: profile.lawyer, status: "active" })
              .then((lawyer) => {
                if (lawyer) {
                  temp = [...temp, 1];
                  info.lawyer = lawyer;
                  info.legal_fields = profile.legal_fields;
                  data = [...data, info];
                  info = {};
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                } else {
                  temp = [...temp, 1];
                  if (temp.length === profiles.length) {
                    res.send(data);
                  }
                }
              })
              .catch((err) => console.log(err));
          } else {
            temp = [...temp, 1];
            if (temp.length === profiles.length) {
              res.send(data);
            }
          }
        }
      });
    })

    .catch((err) => console.log(err));
});

router.get(
  "/all-clients",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let data = [];
    let info = {};
    let counter = [];

    Client.find()
      .then((clients) => {
        res.json(clients);
      })
      .catch((err) => console.log(err));
  }
);

router.get(
  "/contracts",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Contract.find({ client: req.user })
      .then((profile) => {
        if (profile) {
          res.send(profile);
        } else res.send("No contracts");
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/prepare-contract",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    let contract_title = req.body.contract_title;
    let lawyer = req.body.lawyer;
    let payment_amount = req.body.payment_amount;
    let deadline = req.body.deadline;

    Contract.findOne({ contract_title: contract_title, lawyer: lawyer })
      .then((contract) => {
        if (contract) {
          res.send("This agreement already exists");
        } else {
          let newContract = new Contract({
            contract_title: contract_title,
            lawyer: lawyer,
            client: req.user,
            client_agreed: "agreed",
            payment_amount: payment_amount,
            deadline: deadline,
          });

          newContract
            .save()
            .then(() => res.send("Successfully Contracted"))
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/delete-account",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Client.findOneAndDelete({ _id: req.body.client_id })
      .then(() => res.send("success"))
      .catch((err) => console.log(err));
  }
);

// Get conversations list
router.get(
  "/conversations",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    let info = {};
    let data = [];

    let counter = [];
    let counter2 = [];
    Conversation.find({ client: req.user })
      .then((lawyerconversations) => {
        if (lawyerconversations.length) {
          lawyerconversations.forEach((element) => {
            counter = [...counter, element];
            Lawyer.findById(element.lawyer).then((client) => {
              if (client) {
                counter2 = [...counter2, element];
                info._id = element._id;
                info.client = client;
                info.lastMessage = element.lastMessage;
                info.date = element.date;

                data = [...data, info];
                info = {};
                if (counter.length === counter2.length) {
                  res.send(data);
                } else {
                  counter2 = [...counter2, element];
                  info = {};
                  if (counter.length === counter2.length) {
                    res.send(data);
                  }
                }
              }
            });
          });
        } else res.send([]);
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/single-conversation",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    let to = req.body.to;

    Message.find({ lawyer: to, client: req.user })
      .then((lawyerMessage) => {
        // console.log(lawyerMessage);
        if (lawyerMessage.length != 0) {
          res.send(lawyerMessage);
        } else res.send([]);
      })
      .catch((err) => console.log(err));
  }
);

// Post private message
router.post(
  "/post-message",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    let to = req.body.to;

    Lawyer.findById(to)
      .then((client) => {
        Conversation.findOne({ lawyer: client, client: req.user })
          .then((lawyerconversation) => {
            if (lawyerconversation) {
              let updated_fields = {
                date: Date.now(),
                lastMessage: req.body.body,
              };

              Conversation.findOneAndUpdate(
                { lawyer: client, client: req.user },
                updated_fields
              )
                .then((lawyercon) => {
                  let message = new Message({
                    conversation: lawyercon._id,
                    lawyer: req.body.to,
                    client: req.user,
                    body: req.body.body,
                    sender: req.user,
                  });

                  req.io.sockets.emit("messages", req.body.body);

                  message
                    .save()
                    .then(() => res.send("message sent"))
                    .catch((err) => console.log(err));
                })
                .catch((err) => console.log(err));
            } else {
              let newConversation = new Conversation({
                lawyer: client,
                client: req.user,
                lastMessage: req.body.body,
                date: Date.now(),
              });

              newConversation
                .save()
                .then((newConv) => {
                  let message = new Message({
                    conversation: newConv._id,
                    lawyer: req.body.to,
                    client: req.user,
                    body: req.body.body,
                    sender: req.user,
                  });
                  req.io.sockets.emit("messages", req.body.body);

                  message
                    .save()
                    .then(() => res.send("message sent"))
                    .catch((err) => console.log(err));
                })
                .catch((err) => console.log(err));
            }
          })
          .catch((err) => console.log(err));
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/rate-lawyer",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    let lawyer = req.body.id;
    let rating = req.body.rating;

    Lawyer.findOne({ _id: lawyer })
      .then((lawyer) => {
        if (lawyer) {
          let temp = lawyer.rating + rating;
          let newRating = temp / 2;
          let updated_fields = {
            rating: newRating,
          };
          Lawyer.findOneAndUpdate({ _id: lawyer }, updated_fields)
            .then((lawyer) => {
              res.send("rated");
            })
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
);

///// PAYMENT
const Payment = require("../../models/payment.model");
const { language } = require("googleapis/build/src/apis/language");
const stripe = require("stripe")(
  "sk_test_51Ih9guLfNF8q1cxyLAbizKkmJDjBQjKJ18WhoCnR464vVAYcs76Iv09B9rTeyrR74Eszg1Sk7p4lXB1BAvcpGyDC00SDEIoiFr"
);

router.get(
  "/create-customer",
  passport.authenticate("ClientStrategy", { session: false }),
  async (req, res) => {
    let name = req.user.first_name + " " + req.user.last_name;
    let email = req.user.email;

    var createCustomer = function (email, name) {
      var param = {};
      param.email = email;
      param.name = name;
      param.description = "from node";

      let data = [];

      Client.findOne({ email: email })
        .then((law) => {
          Payment.findOne({ client: law })
            .then((pay) => {
              if (!pay) {
                let x;
                stripe.customers.create(param, function (err, customer) {
                  if (err) {
                    console.log("error", err);
                    res.send("failed");
                  } else if (customer) {
                    x = customer["id"];

                    Client.findOne({ email: email })
                      .then((lawyer) => {
                        let newPayment = new Payment({
                          client: lawyer,
                          customer_id: x,
                        });

                        newPayment
                          .save()
                          .then(() => {
                            data = [...data, x];
                            res.send("success");
                          })
                          .catch((err) => console.log(err));
                      })
                      .catch((err) => console.log(err));

                    return customer;
                  } else res.send("Something wrong");
                });
              } else res.send("Nothing");
            })
            .catch((err) => console.log(err));
        })
        .catch((err) => console.log(err));
    };
    createCustomer(email, name);
  }
);

router.post(
  "/create-token",
  passport.authenticate("ClientStrategy", { session: false }),
  async (req, res) => {
    var createToken = function (email, cardNumber, exp_month, exp_year, cvc) {
      var param = {};
      param.card = {
        number: cardNumber,
        exp_month: exp_month,
        exp_year: exp_year,
        cvc: cvc,
      };

      Client.findOne({ email: email })
        .then((client) => {
          Payment.findOne({ client: client })
            .then((pay) => {
              stripe.tokens.create(param, function (err, token) {
                if (err) {
                  res.send("failed");
                } else if (token) {
                  let updated_fields = {
                    token_id: token["id"],
                  };

                  Payment.findOneAndUpdate({ client: client }, updated_fields)
                    .then(() => {
                      res.send("success");
                    })
                    .catch((err) => console.log(err));
                } else res.send("failed");
              });
            })
            .catch((err) => console.log(err));
        })
        .catch((err) => console.log(err));
    };

    createToken(
      req.user.email,
      req.body.cardNumber,
      req.body.exp_month,
      req.body.exp_year,
      req.body.cvc
    );
  }
);

router.get(
  "/add-card",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Payment.findOne({ client: req.user })
      .then((payment) => {
        if (payment) {
          var addCardToCustomer = function (cus_id, token_id) {
            stripe.customers.createSource(
              cus_id,
              { source: token_id },
              function (err, card) {
                if (err) {
                  res.send("failed");
                } else if (card) {
                  let updated_fields = {
                    has_card: true,
                    card_id: card.id,
                  };

                  Payment.findOneAndUpdate({ client: req.user }, updated_fields)
                    .then((pay) => res.send("success"))
                    .catch((err) => console.log(err));
                } else {
                  res.send("failed");
                }
              }
            );
          };

          addCardToCustomer(payment.customer_id, payment.token_id);
        } else res.send("not added");
      })
      .catch((err) => console.log(err));
  }
);

const PORT =
  "";

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(PORT);

router.post(
  "/pay",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Contract.findById(req.body.contract_id).then((contract) => {
      Payment.findOne({ client: req.user })
        .then((payment) => {
          if (payment) {
            var chargeCustomerThroughCustomerID = function (
              cus_id,
              amount,
              currency,
              description
            ) {
              var param = {
                amount: amount,
                currency: currency,
                description: description,
                customer: cus_id,
              };

              stripe.charges.create(param, function (err, charge) {
                if (err) {
                  res.send("failed");
                } else if (charge) {
                  Lawyer.findOne({ _id: contract.lawyer })
                    .then((lawyer) => {
                      let updated = {
                        status: "started",
                      };
                      Contract.findByIdAndUpdate(
                        req.body.contract_id,
                        updated
                      ).then((contract) => {
                        let newBalance =
                          lawyer.balance - contract.payment_amount * 0.12;

                        let updated_fields = {
                          balance: newBalance,
                        };

                        Lawyer.findByIdAndUpdate(
                          contract.lawyer,
                          updated_fields
                        )
                          .then((law) => {
                            let newReceipt = new Receipt({
                              contract: contract,
                              to: law,
                              client: req.user,
                            });
                            newReceipt
                              .save()
                              .then((rec) => {
                                const msg = {
                                  to: "Infos.claimyourrights@gmail.com",
                                  from: "infos@claimyourrights.ch",
                                  subject: "Payment Reciept",
                                  text: `The Receipt is: `,
                                  html: `<div class="invoice-box" style="max-width: 800px;margin: auto;padding: 30px;border: 1px solid #eee;box-shadow: 0 0 10px rgba(0, 0, 0, .15);font-size: 16px;line-height: 24px;font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;color: #555;">
                                <table cellpadding="0" cellspacing="0" style="width: 100%;line-height: inherit;text-align: left;">
                                    <tr class="top">
                                        <td colspan="2" style="padding: 5px;vertical-align: top;">
                                            <table style="width: 100%;line-height: inherit;text-align: left;">
                                                <tr>
                                                    <td class="title" style="padding: 5px;vertical-align: top;padding-bottom: 20px;font-size: 45px;line-height: 45px;color: #333;">
                                                        Claim Your Rights
                                                    </td>
                                                    
                                                    <td style="padding: 5px;vertical-align: top;text-align: right;padding-bottom: 20px;">
                                                        Invoice #: ${
                                                          rec._id
                                                        }<br>
                                                        Created: ${new Date()
                                                          .toISOString()
                                                          .replace(/T/, " ")
                                                          .replace(
                                                            /\..+/,
                                                            ""
                                                          )}<br>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    
                                    <tr class="information">
                                        <td colspan="2" style="padding: 5px;vertical-align: top;">
                                            <table style="width: 100%;line-height: inherit;text-align: left;">
                                                <tr>
                                                    <td style="padding: 5px;vertical-align: top;padding-bottom: 40px;">
                                                        
                                                    </td>
                                                    
                                                    <td style="padding: 5px;vertical-align: top;text-align: right;padding-bottom: 40px;">
                                                        Payment made to<br>
                                                        ${law.first_name} ${
                                    law.last_name
                                  }<br>
                                                        ${law.email}
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    
                                    <tr class="heading">
                                        <td style="padding: 5px;vertical-align: top;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                                            Payment Method
                                        </td>
                                    </tr>
                                    
                                    <tr class="details">
                                        <td style="padding: 5px;vertical-align: top;padding-bottom: 20px;">
                                            CARD
                                        </td>
                                    </tr>
                                    
                                    <tr class="heading">
                                        <td style="padding: 5px;vertical-align: top;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                                            Contract
                                        </td>
                                        
                                        <td style="padding: 5px;vertical-align: top;text-align: right;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                                            Price
                                        </td>
                                    </tr>
                                    
                                    
                                    <tr class="item last">
                                        <td style="padding: 5px;vertical-align: top;border-bottom: none;">
                                            ${contract.contract_title}
                                        </td>
                                        
                                        <td style="padding: 5px;vertical-align: top;text-align: right;border-bottom: none;">
                                            ${contract.payment_amount}
                                        </td>
                                    </tr>
                                    
                                    <tr class="total">
                                        <td style="padding: 5px;vertical-align: top;"></td>
                                        
                                        <td style="padding: 5px;vertical-align: top;text-align: right;border-top: 2px solid #eee;font-weight: bold;">
                                           Total: ${contract.payment_amount}
                                        </td>
                                    </tr>
                                </table>`,
                                };
                                sgMail
                                  .send(msg)
                                  .then(() => res.send("success"))
                                  .catch((err) =>
                                    console.log(
                                      "Error while sending an email",
                                      err
                                    )
                                  );
                              })
                              .catch((err) => console.log(err));
                          })
                          .catch((err) => console.log(err));
                      });
                    })
                    .catch((err) => console.log(err));
                } else {
                  res.send("failed");
                }
              });
            };
            chargeCustomerThroughCustomerID(
              payment.customer_id,
              contract.payment_amount,
              "chf",
              req.body.description
            );
          } else res.send("failed");
        })
        .catch((err) => console.log(err));
    });
  }
);

router.post(
  "/complete-work",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    Contract.findById(req.body.contract_id).then((con) => {
      Lawyer.findOne({ _id: con.lawyer }).then((lawyer) => {
        let updated = {
          balance: lawyer.balance + con.payment_amount,
        };

        Lawyer.findOneAndUpdate({ _id: con.lawyer }, updated)
          .then(() => {
            // Payment.findOne({ lawyer: lawyer._id })
            //   .then((customer) => {
            // stripe.transfers.create({
            //   amount: 100,
            //   currency: "chf",
            //   destination: customer.customer_id,
            //   transfer_group: "{ORDER10}",
            // });
            let updated_fields = {
              status: "complete",
            };

            Contract.findByIdAndUpdate(req.body.contract_id, updated_fields)
              .then(() => res.send("success"))
              .catch((err) => console.log(err));
            // })
            // .catch((err) => console.log(err));
          })
          .catch((err) => console.log(err));
      });
    });
  }
);

// Routes payment for Exprired Accounts
// subscribe
router.post("/subscribe_company", (req, res) => {
  // company info
  const companyEmail = req.body.email;

  Client.findOne({ email: companyEmail }).then((comp) => {
    // Check if company exists
    if (comp) {
      const company_email = comp.email;
      const company_id = comp._id;
      const company_name = comp.name;
      // check if the customer is already created for
      // the company
      Customer.findOne({ company: company_id }).then((customer) => {
        // if the data exists
        if (customer) {
          res.json({
            message: "pending",
            success: true,
          });
        } else {
          // if the customer data does not exits
          // create a new stripe customer
          createStripeCustomer(
            "", // company description
            company_email,
            company_name,
            "" // phone number
          ).then(
            // if the customer creation is successful
            function (data) {
              // create new customer
              let newCustomer = new Customer({
                customer_id: data.id,
                company: company_id,
              });

              // save the new customer
              newCustomer.save();

              res.json({
                message: "done",
                success: true,
              });
            },

            // if customer creation throws an error
            function (err) {
              res.status(500).json({
                success: false,
                error: "An error has encountered!",
                data: err,
              });
            }
          );
        }
      });
    } else {
      // Campany couldn't be found with that email, throw a 400
      res.status(400).json({
        message: "No account has been found with that email.",
        success: false,
      });
    }
  });
});
// Process for activation
router.post("/activate_process_payment", async (req, res) => {
  // subscription plans
  const PLANS = ["ClaimYourRights"];

  // get request data
  let company_email = req.body.email;
  let name = req.body.name;
  let credit_card = req.body.cc;
  let month = req.body.month;
  let year = req.body.year;
  let cvc = req.body.cvc;
  let subtype = "ClaimYourRights";

  // company object id
  // const company_id = req.user._id;

  // customer updates
  let customerUpdates = {};

  // check if the subscription plan is valid

  if (PLANS.includes(subtype)) {
    // Get company by email
    Client.findOne({ email: company_email }).then((comp) => {
      // Check if company exists
      if (comp) {
        const company_id = comp._id;
        // check if the company has already subscribed
        Customer.findOne({ company: company_id }).then(async (customerData) => {
          // stripe customer data
          const stripeCustomerID = customerData.customer_id;

          if (customerData.subscription_id != "") {
            if (customerData.subscription === subtype) {
              // if the user tries to subscribe with the same plan
              // throw an error
              res.status(400).json({
                success: false,
                message: `You have already subscribed to ${subtype}.`,
              });
            } else {
              // check if the customer has attached cc
              // check if the cc is valid
              // cancel the prev subscription
              // subscribe to the new subscription

              try {
                // get customer data to check cc attach status
                const companyCustomerData = await getCustomerByID(
                  stripeCustomerID
                );

                // check if the customer has attach a cc source
                if (companyCustomerData.default_source === "") {
                  // attach a payment source
                  try {
                    // create a cc payment source
                    const paymentToken = await createPaymentCardToken(
                      credit_card,
                      month,
                      year,
                      cvc,
                      name
                    );

                    // attach the payment source to the company customer account
                    await attachPaymentSource(
                      stripeCustomerID,
                      paymentToken.id
                    );

                    // update the customer model
                    Customer.findOneAndUpdate(
                      { company: company_id },
                      { cc_attached: true }
                    )
                      .then((_) => {})
                      .catch((_) => {});
                  } catch (err) {
                    res.status(400).json({
                      success: false,
                      message: err,
                      extra: {
                        message: "attaching/creating",
                      },
                    });
                  }
                }

                // if the company has attached the payment source
                // cancel the prev subscription and add the new

                try {
                  let subPlan = "price_1IkuLsLfNF8q1cxyLjE3CbGl";
                  // cancel the prev subscription plan
                  await cancelSubscription(customerData.subscription_id);

                  // set the customer subscription update
                  customerUpdates.subscription = subtype;

                  // subscribe company
                  try {
                    let subscriptionData = await subscribeCustomer(
                      stripeCustomerID,
                      subPlan
                    );

                    // set the new subscription id
                    customerUpdates.subscription_id = subscriptionData.id;

                    // update customer model
                    Customer.findOneAndUpdate(
                      { company: company_id },
                      customerUpdates
                    )
                      .then((_) => {
                        // if all the updates are done
                        // send a 200 response
                        subscriptionController.user_activator(
                          company_email,
                          function (res) {
                            if (res) {
                              //console.log("has been activated")
                            } else {
                              console.log("error");
                            }
                          }
                        );

                        res.json({
                          message: `You have subscribed to ${subtype}.`,
                          success: true,
                        });
                      })
                      .catch((_) => {
                        // if an error was thrown while updating
                        res.status(500).json({
                          message: `An error was encountered while subscribing to ${subType}.`,
                          success: false,
                          extra: {
                            message: "error while updating customer model",
                          },
                        });
                      });
                  } catch (err) {
                    // if an error was thrown while subscribing the company
                    // throw a 500 response
                    res.status(500).json({
                      message: `An error was encountered while subscribing to ${subType}.`,
                      success: false,
                    });
                  }
                } catch (err) {
                  // if canceling the subscription has thrown an error
                  // response with 500
                  res.status(500).json({
                    message:
                      "An error has encountered while canceling your subscription, try again later",
                    success: false,
                    extra: {
                      error: err,
                    },
                  });
                }
              } catch (err) {
                // if an error thrown while fetching customer data
                // throw a 500 error.
                res.status(500).json({
                  message: "Server error, error while fetching customer data.",
                  success: false,
                  extra: {
                    message: "Error fetching customer data",
                  },
                });
              }
            }
          } else {
            try {
              // create a cc payment source
              const paymentToken = await createPaymentCardToken(
                credit_card,
                month,
                year,
                cvc,
                name
              );

              try {
                // attach the payment source to the company customer account
                await attachPaymentSource(stripeCustomerID, paymentToken.id);

                // set the cc_attach flag for later update
                customerUpdates.cc_attached = true;

                // subscribe company to the plan
                try {
                  // get the subscription plan price
                  // let subPlan = await getPlanPrice(subType);

                  // // if an invalid plan is passed thrown an error
                  // if (subPlan === "") throw new Error("Invalid subscription plan.");

                  let subPlan = "price_1IkuLsLfNF8q1cxyLjE3CbGl";

                  // subscribe company
                  let subscriptionData = await subscribeCustomer(
                    stripeCustomerID,
                    subPlan
                  );

                  // if the company subscription is active
                  // update the customer model and company
                  // model
                  if (subscriptionData.status === "active") {
                    // if the subscription is active
                    // set the subscription to the company
                    // prefered subscription type
                    customerUpdates.subscription = subtype;

                    // set the subscription id of the company
                    // stripe customer
                    customerUpdates.subscription_id = subscriptionData.id;

                    Customer.findOneAndUpdate(
                      { customer_id: stripeCustomerID },
                      customerUpdates
                    )
                      .then((_) => {
                        // after finishing updating the customer model with
                        // the approprate field
                        // update the subscribed flag of the company

                        Client.findOneAndUpdate(
                          { _id: company_id },
                          { is_subscribed: true, subscription_type: subtype }
                        )
                          .then((_) => {
                            // after finshing updating the subscribed
                            // flag of the company, send a success Obj
                            res.json({
                              message: "Subscribed",
                              success: true,
                            });
                          })
                          .catch((err) => {
                            // if updating the company model has thrown an
                            // error response with 500 error
                            res.status(500).json({
                              message:
                                "An error has encountered while subscribing customer",
                              success: false,
                              extra: {
                                error: err,
                                message: "updating company model",
                              },
                            });
                          });
                      })
                      .catch((err) => {
                        // if updating the customer model has thrown an
                        // error response with 500 error
                        res.status(500).json({
                          message:
                            "An error has encountered while subscribing customer",
                          success: false,
                          extra: {
                            error: err,
                            message: "updating customer model",
                          },
                        });
                      });
                  }
                } catch (err) {
                  // if subscribing the company has thrown an error
                  // response with 500 error
                  res.status(500).json({
                    message:
                      "An error has encountered while subscribing customer",
                    success: false,
                    extra: {
                      error: err,
                      message: "subscribing company",
                    },
                  });
                }
              } catch (error) {
                // if attaching payment source to company stripe account
                // has thrown an error response with 400
                res.status(400).json({
                  success: false,
                  message: error.raw.message,
                  extra: {
                    message: "attaching",
                  },
                });
              }
            } catch (error) {
              res.status(400).json({
                success: false,
                message: error.raw.message,
              });
            }
          }
        });
      } else {
        // Campany couldn't be found with that email, throw a 400
        res.status(400).json({
          message: "No account has been found with that email.",
          success: false,
        });
      }
    });
  } else {
    // if an invalid subscription plan was entered, throw a 400
    res.status(400).json({
      message: "Invalid subscription plan.",
      success: false,
    });
  }
});

// subscribe
router.get(
  "/subscribe_company",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    // company info
    const company_id = req.user._id;
    const company_name = req.user.name;
    const company_email = req.user.email;

    // check if the customer is already created for
    // the company
    Customer.findOne({ company: company_id }).then((customer) => {
      // if the data exists
      if (customer) {
        res.json({
          message: "pending",
          success: true,
        });
      } else {
        // if the customer data does not exits
        // create a new stripe customer
        createStripeCustomer(
          "", // company description
          company_email,
          company_name,
          "" // phone number
        ).then(
          // if the customer creation is successful
          function (data) {
            // create new customer
            let newCustomer = new Customer({
              customer_id: data.id,
              company: company_id,
            });

            // save the new customer
            newCustomer.save();

            res.json({
              message: "done",
              success: true,
            });
          },

          // if customer creation throws an error
          function (err) {
            res.status(500).json({
              success: false,
              error: "An error has encountered!",
              data: err,
            });
          }
        );
      }
    });
  }
);
// process payment
router.post(
  "/process_payment",
  passport.authenticate("ClientStrategy", { session: false }),
  async (req, res) => {
    // subscription plans
    const PLANS = ["ClaimYourRights"];

    // get request data
    let name = req.body.name;
    let credit_card = req.body.cc;
    let month = req.body.month;
    let year = req.body.year;
    let cvc = req.body.cvc;
    let subtype = "ClaimYourRights";

    // company object id
    const company_id = req.user._id;

    // customer updates
    let customerUpdates = {};

    // check if the subscription plan is valid

    if (PLANS.includes(subtype)) {
      // check if the company has already subscribed
      Customer.findOne({ company: company_id }).then(async (customerData) => {
        // stripe customer data
        const stripeCustomerID = customerData.customer_id;

        if (customerData.subscription_id != "") {
          if (customerData.subscription === subtype) {
            // if the user tries to subscribe with the same plan
            // throw an error
            res.status(400).json({
              success: false,
              message: `You have already subscribed to ${subtype}.`,
            });
          } else {
            // check if the customer has attached cc
            // check if the cc is valid
            // cancel the prev subscription
            // subscribe to the new subscription

            try {
              // get customer data to check cc attach status
              const companyCustomerData = await getCustomerByID(
                stripeCustomerID
              );

              console.log("customer data ", companyCustomerData);
              // check if the customer has attach a cc source
              if (companyCustomerData.default_source === "") {
                // attach a payment source
                try {
                  // create a cc payment source
                  const paymentToken = await createPaymentCardToken(
                    credit_card,
                    month,
                    year,
                    cvc,
                    name
                  );

                  // attach the payment source to the company customer account
                  await attachPaymentSource(stripeCustomerID, paymentToken.id);

                  // update the customer model
                  Customer.findOneAndUpdate(
                    { company: company_id },
                    { cc_attached: true }
                  )
                    .then((_) => {})
                    .catch((_) => {});
                } catch (err) {
                  res.status(400).json({
                    success: false,
                    message: err,
                    extra: {
                      message: "attaching/creating",
                    },
                  });
                }
              }

              // if the company has attached the payment source
              // cancel the prev subscription and add the new

              try {
                let subPlan = "price_1IkuLsLfNF8q1cxyLjE3CbGl";

                // cancel the prev subscription plan
                await cancelSubscription(customerData.subscription_id);

                // set the customer subscription update
                customerUpdates.subscription = subtype;

                // subscribe company
                try {
                  let subscriptionData = await subscribeCustomer(
                    stripeCustomerID,
                    subPlan
                  );

                  // set the new subscription id
                  customerUpdates.subscription_id = subscriptionData.id;

                  // update customer model
                  Customer.findOneAndUpdate(
                    { company: company_id },
                    customerUpdates
                  )
                    .then((_) => {
                      // if all the updates are done
                      // send a 200 response
                      res.json({
                        message: `You have subscribed to ${subtype}.`,
                        success: true,
                      });
                    })
                    .catch((error) => {
                      // if an error was thrown while updating
                      console.log("errror", error);
                      res.status(500).json({
                        message: `An error was encountered while subscribing to ${subType}.`,
                        success: false,
                        extra: {
                          message: "error while updating customer model",
                        },
                      });
                    });
                } catch (err) {
                  // if an error was thrown while subscribing the company
                  // throw a 500 response
                  console.log("errror", err);
                  res.status(500).json({
                    message: `An error was encountered while subscribing to ${subType}.`,
                    success: false,
                  });
                }
              } catch (err) {
                // if canceling the subscription has thrown an error
                // response with 500
                console.log("errror", err);
                res.status(500).json({
                  message:
                    "An error has encountered while canceling your subscription, try again later",
                  success: false,
                  extra: {
                    error: err,
                  },
                });
              }
            } catch (err) {
              // if an error thrown while fetching customer data
              // throw a 500 error.
              console.log("errror", err);
              res.status(500).json({
                message: "Server error, error while fetching customer data.",
                success: false,
                extra: {
                  message: "Error fetching customer data",
                },
              });
            }
          }
        } else {
          try {
            // create a cc payment source
            const paymentToken = await createPaymentCardToken(
              credit_card,
              month,
              year,
              cvc,
              name
            );

            try {
              // attach the payment source to the company customer account
              await attachPaymentSource(stripeCustomerID, paymentToken.id);

              // set the cc_attach flag for later update
              customerUpdates.cc_attached = true;

              // subscribe company to the plan
              try {
                // get the subscription plan price
                // let subPlan = await getPlanPrice(subType);

                // // if an invalid plan is passed thrown an error
                // if (subPlan === "") throw new Error("Invalid subscription plan.");

                let subPlan = "price_1IkuLsLfNF8q1cxyLjE3CbGl";

                // subscribe company
                let subscriptionData = await subscribeCustomer(
                  stripeCustomerID,
                  subPlan
                );

                // if the company subscription is active
                // update the customer model and company
                // model
                if (subscriptionData.status === "active") {
                  // if the subscription is active
                  // set the subscription to the company
                  // prefered subscription type
                  customerUpdates.subscription = subtype;

                  // set the subscription id of the company
                  // stripe customer
                  customerUpdates.subscription_id = subscriptionData.id;

                  Customer.findOneAndUpdate(
                    { customer_id: stripeCustomerID },
                    customerUpdates
                  )
                    .then((_) => {
                      // after finishing updating the customer model with
                      // the approprate field
                      // update the subscribed flag of the company

                      Client.findOneAndUpdate(
                        { _id: company_id },
                        { is_subscribed: true, subscription_type: subtype }
                      )
                        .then((_) => {
                          // after finshing updating the subscribed
                          // flag of the company, send a success Obj
                          res.json({
                            message: "Subscribed",
                            success: true,
                          });
                        })
                        .catch((err) => {
                          // if updating the company model has thrown an
                          // error response with 500 error
                          console.log("errror", err);
                          res.status(500).json({
                            message:
                              "An error has encountered while subscribing customer",
                            success: false,
                            extra: {
                              error: err,
                              message: "updating company model",
                            },
                          });
                        });
                    })
                    .catch((err) => {
                      // if updating the customer model has thrown an
                      // error response with 500 error
                      console.log("errror", err);
                      res.status(500).json({
                        message:
                          "An error has encountered while subscribing customer",
                        success: false,
                        extra: {
                          error: err,
                          message: "updating customer model",
                        },
                      });
                    });
                }
              } catch (err) {
                // if subscribing the company has thrown an error
                // response with 500 error
                console.log("errror", err);
                res.status(500).json({
                  message:
                    "An error has encountered while subscribing customer",
                  success: false,
                  extra: {
                    error: err,
                    message: "subscribing company",
                  },
                });
              }
            } catch (error) {
              // if attaching payment source to company stripe account
              // has thrown an error response with 400
              res.status(400).json({
                success: false,
                message: error.raw.message,
                extra: {
                  message: "attaching",
                },
              });
            }
          } catch (error) {
            res.status(400).json({
              success: false,
              message: error.raw.message,
            });
          }
        }
      });
    } else {
      // if an invalid subscription plan was entered, throw a 400
      res.status(400).json({
        message: "Invalid subscription plan.",
        success: false,
      });
    }
  }
);

// get company subscription info
router.get(
  "/my_subscription",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    // company id
    const company_id = req.user._id;

    // check if the company is subscribed
    Client.findOne({ _id: company_id })
      .then((companyData) => {
        // check if the company is registered
        // from company model
        if (companyData.is_subscribed) {
          Customer.findOne({ company: company_id })
            .then((customer) => {
              // if the customer return with an obj
              // response with customer subscription
              // data
              res.json({
                subscription_type: customer.subscription,
                is_subscribed: true,
                subscription_date: customer.subscribed_date,
                cc_attached: customer.cc_attached,
                success: true,
              });
            })
            .catch((_) => {
              // if a company has not subscribe to any of
              // the plan, response with 400
              res.status(400).json({
                message: "You have not subscribed yet!",
                success: false,
              });
            });
        } else {
          res.status(400).json({
            message: "You have not subscribed yet!",
            subscribed: false,
          });
        }
      })
      .catch((_) => {
        res.status(400).json({
          message: "You have not subscribed yet!",
          success: false,
        });
      });
  }
);

// cancel subscription
router.get(
  "/cancel_subscription",
  passport.authenticate("ClientStrategy", { session: false }),
  (req, res) => {
    // company obj id
    const company_id = req.user._id;

    // check if company has subscribed
    Customer.findOne({ company: company_id })
      .then((companyData) => {
        // subscription id
        const subscription_id = companyData.subscription_id;

        cancelSubscription(subscription_id).then(
          // if the subscription has been canceled successfuly
          function (cancelData) {
            // remove the subscription id from customer
            // and set the is_subscribed flag to false

            const customerUpdates = {
              subscription_id: "",
              subscription: "",
            };

            // update customer
            Customer.findOneAndUpdate({ company: company_id }, customerUpdates)
              .then((_) => {
                // update compay

                const companyUpdates = {
                  is_subscribed: false,
                };

                Client.findOneAndUpdate({ _id: company_id }, companyUpdates)
                  .then((_) => {
                    res.json({
                      success: true,
                      message: "Subscription has been canceled!",
                      status: cancelData.status,
                    });
                  })
                  .catch((_) => {
                    res.status(500).json({
                      success: false,
                      message:
                        "An error has occurred while canceling your subscription!",
                    });
                  });
              })
              .catch((_) => {
                res.status(500).json({
                  success: false,
                  message:
                    "An error has occurred while canceling your subscription!",
                });
              });
          },

          // if the subscription throws an error
          function (_) {
            res.status(500).json({
              success: false,
              message:
                "An error has occurred while canceling your subscription!",
            });
          }
        );
      })
      .catch((_) => {
        res.status(400).json({
          success: false,
          message: "You have not subscribed to any of the plans!",
        });
      });
  }
);

module.exports = router;
