const express = require("express");
const router = express.Router();
const gravatar = require("gravatar");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const keys = require("../../config/keys");
const passport = require("passport");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const PORT =
  "";

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(PORT);
const image = fs.createReadStream("./routes/api/transparentLogo.png");

//Load Input Validation
const validateRegisterInput = require("../../validation/userRegister");
//Load Input Validation
const validateLoginInput = require("../../validation/login");
const validateChangePassword = require("../../validation/new.password");

const Lawyer = require("../../models/lawyer.model");
const Client = require("../../models/client.model");
const Education = require("../../models/education.model");
const Experience = require("../../models/experience.model");
const Profile = require("../../models/profile.model");
const Contract = require("../../models/contract.model");
const Message = require("../../models/message.model");
const Conversation = require("../../models/conversation.model");
const Photo = require("../../models/photo.model");

router.post("/register", (req, res) => {
  const { errors } = validateLoginInput(req.body);

  const first_name = req.body.first_name;
  const last_name = req.body.last_name;
  const password = req.body.password;
  const email = req.body.email;

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) throw err;

      Lawyer.findOne({ email: email }).then((user) => {
        if (user) {
          errors.error = "User already added";
          res.status(400).json(errors);
        } else {
          let newLawyer = new Lawyer({
            first_name: first_name,
            last_name: last_name,
            email: email,
            password: hash,
          });

          newLawyer
            .save()
            .then((newclient) => res.send("Successfully Registered."))
            .catch((err) => console.log(err));
        }
      });
    });
  });
});

router.get(
  "/current",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Payment.findOne({ lawyer: req.user }).then((payment) => {
      if (payment) {
        res.json({
          id: req.user._id,
          email: req.user.email,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          profile_built: req.user.profile_built,
          role: req.user.role,
          rating: req.user.rating,
          approval_requested: req.user.approval_requested,
          status: req.user.status,
          balance: req.user.balance,
          has_card: payment.has_card,
        });
      } else {
        res.json({
          id: req.user._id,
          email: req.user.email,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          profile_built: req.user.profile_built,
          role: req.user.role,
          rating: req.user.rating,
          approval_requested: req.user.approval_requested,
          status: req.user.status,
          has_card: false,
        });
      }
    });
  }
);

router.post(
  "/delete-account",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Lawyer.findOneAndDelete({ _id: req.body.lawyer_id })
      .then(() => res.send("success"))
      .catch((err) => console.log(err));
  }
);

router.get("/all-lawyers", (req, res) => {
  let data = [];
  let info = {};
  let counter = [];

  Lawyer.find({ status: "active", role: "lawyer" })
    .then((lawyers) => {
      res.json(lawyers);
    })
    .catch((err) => console.log(err));
});
router.post("/login", (req, res) => {
  const { errors, isValid } = validateLoginInput(req.body);

  //Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const password = req.body.password;
  //Find company by email
  Lawyer.findOne({ email })
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
            const payload = {
              id: user.id,
              name: user.email,
              status: user.status,
            }; //Create JWT

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
  Lawyer.findOne({ email: userEmail })
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

        Lawyer.findOneAndUpdate({ email: userEmail }, updatedFields)
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
                  <a href=http://env-4469307.jcloud-ver-jpc.ik-server.com/#/lawyer/verify-password-reset/${token}>
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

    Lawyer.findOne({ resetPasswordToken: token })
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
      Lawyer.findOneAndUpdate({ resetPasswordToken: token }, updatedFields)
        .then((user) => {
          return res.json(user);
        })
        .catch((err) => {
          return res.json(err);
        });
    });
  });
});

router.get(
  "/clients",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Client.find()
      .then((clients) => {
        res.send(clients);
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/build-profile",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    const { errors } = validateLoginInput(req.body);

    const location = req.body.location;
    const date = req.body.date;
    const tariff = req.body.tariff;
    const gravatar = req.body.gravatar;
    const description = req.body.description;
    const short_description = req.body.short_description;
    const career_path = req.body.career_path;
    const languages = req.body.languages;
    const legal_fields = req.body.legal_fields;
    const services = req.body.services;

    Profile.findOne({ lawyer: req.user })
      .then((user) => {
        if (user) {
          errors.user = "Profile already built.";
          res.status(400).json(errors);
        } else {
          let newProfile = new Profile({
            location: location,
            date: date,
            tariff: tariff,
            gravatar: gravatar,
            description: description,
            short_description: short_description,
            career_path: career_path,
            languages: languages,
            legal_fields: legal_fields,
            services: services,
            lawyer: req.user,
          });

          let updated_fields = {
            profile_built: true,
          };

          Lawyer.findOneAndUpdate({ _id: req.user._id }, updated_fields)
            .then(() => {})
            .catch((err) => console.log(err));

          newProfile
            .save()
            .then((newProfile) => res.send("Profile Successfully Built."))
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/edit-profile",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    const { errors } = validateLoginInput(req.body);

    const location = req.body.location;
    const tariff = req.body.tariff;
    // const gravatar = req.body.gravatar;
    const description = req.body.description;
    const short_description = req.body.short_description;
    const career_path = req.body.career_path;
    const languages = req.body.languages;
    const legal_fields = req.body.legal_fields;
    const services = req.body.services;

    Profile.findOne({ lawyer: req.user })
      .then((user) => {
        if (!user) {
          errors.user = "No profile to update.";
          res.status(400).json(errors);
        } else {
          // let newProfile = new Profile({
          //   location: location,
          //   date: date,
          //   tariff: tariff,
          //   gravatar: gravatar,
          //   description: description,
          //   short_description: short_description,
          //   career_path: career_path,
          //   languages: languages,
          //   legal_fields: legal_fields,
          //   services: services,
          //   lawyer: req.user,
          // });

          let updated_fields = {
            location: location,
            tariff: tariff,
            // gravatar: gravatar,
            description: description,
            short_description: short_description,
            career_path: career_path,
            languages: languages,
            legal_fields: legal_fields,
            services: services,
            // lawyer: req.user,
          };

          Profile.findOneAndUpdate({ lawyer: req.user._id }, updated_fields)
            .then(() => {
              res.send("Profile Updated successfully.");
            })
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
);
router.post(
  "/add-education",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    const insitution = req.body.insitution;
    const education_level = req.body.education_level;
    const field_of_study = req.body.field_of_study;
    const from = req.body.from;
    const to = req.body.to;
    const current = req.body.current;
    const description = req.body.description;

    Education.findOne({ insitution: insitution })
      .then((education) => {
        if (education) {
          res.send("Education record in this institution already exists");
        } else {
          let newEducation = new Education({
            insitution: insitution,
            education_level: education_level,
            field_of_study: field_of_study,
            from: from,
            to: to,
            current: current,
            description: description,
            lawyer: req.user,
          });

          newEducation
            .save()
            .then((neweducation) => res.send("Successfully Added Educaiton."))
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/add-experience",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    const position = req.body.position;
    const company = req.body.company;
    const location = req.body.location;
    const from = req.body.from;
    const to = req.body.to;
    const current = req.body.current;
    const description = req.body.description;

    Experience.findOne({ company: company })
      .then((experience) => {
        if (experience) {
          res.send("Experience record in this institution already exists");
        } else {
          let newExperience = new Experience({
            position: position,
            company: company,
            location: location,
            from: from,
            to: to,
            current: current,
            description: description,
            lawyer: req.user,
          });

          newExperience
            .save()
            .then((newexperience) => res.send("Successfully Added Educaiton."))
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  }
);

router.get(
  "/get-profile",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Profile.findOne({ lawyer: req.user })
      .then((profile) => {
        if (profile) {
          res.send(profile);
        } else res.send("No profile");
      })
      .catch((err) => console.log(err));
  }
);

router.get(
  "/get-education",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Education.find({ lawyer: req.user })
      .then((profile) => {
        if (profile) {
          res.send(profile);
        } else res.send("No education");
      })
      .catch((err) => console.log(err));
  }
);

router.get(
  "/get-experience",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Experience.find({ lawyer: req.user })
      .then((profile) => {
        if (profile) {
          res.send(profile);
        } else res.send("No experience");
      })
      .catch((err) => console.log(err));
  }
);

router.get(
  "/contracts",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Contract.find({ lawyer: req.user })
      .then((profile) => {
        if (profile) {
          res.send(profile);
        } else res.send("No contracts");
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/accept-contract",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Contract.findOne({ lawyer: req.user, _id: req.body.contract_id })
      .then((contract) => {
        if (contract) {
          let updated_fields = {
            lawyer_agreed: "agreed",
          };

          Contract.findOneAndUpdate(
            { lawyer: req.user, _id: req.body.contract_id },
            updated_fields
          )
            .then((contract) => res.send("Contract Agreed"))
            .catch((err) => console.log(err));
        } else res.send("No contracts");
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/reject-contract",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Contract.findOne({ lawyer: req.user, _id: req.body.contract_id })
      .then((contract) => {
        if (contract) {
          let updated_fields = {
            lawyer_agreed: "not agreed",
          };

          Contract.findOneAndUpdate(
            { lawyer: req.user, _id: req.body.contract_id },
            updated_fields
          )
            .then((contract) => res.send("Contract Agreed"))
            .catch((err) => console.log(err));
        } else res.send("No contracts");
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/contracts",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Contract.find({ lawyer: req.user }).then((contracts) => {
      if (contracts.length != 0) {
        res.send(contracts);
      } else res.send([contracts]);
    });
  }
);

// Get conversations list
router.get(
  "/conversations",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let info = {};
    let data = [];

    let counter = [];
    Conversation.find({ lawyer: req.user })
      .then((lawyerconversations) => {
        // console.log(lawyerconversations);
        if (lawyerconversations.length != 0) {
          lawyerconversations.forEach((element) => {
            counter = [...counter, element];
            Client.findById(element.client).then((client) => {
              if (client) {
                info._id = element._id;
                info.client = client;
                info.lastMessage = element.lastMessage;
                info.date = element.date;

                data = [...data, info];
                info = {};
                if (counter.length === data.length) {
                  res.send(data);
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
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let to = req.body.to;
    // console.log(to);

    Message.find({ client: to, lawyer: req.user })
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
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let to = req.body.to;

    Client.findById(to)
      .then((client) => {
        Conversation.findOne({ client: client, lawyer: req.user })
          .then((lawyerconversation) => {
            if (lawyerconversation) {
              let updated_fields = {
                date: Date.now(),
                lastMessage: req.body.body,
              };
              Conversation.findOneAndUpdate(
                { client: client, lawyer: req.user },
                updated_fields
              )
                .then((lawyercon) => {
                  let message = new Message({
                    conversation: lawyercon._id,
                    client: req.body.to,
                    lawyer: req.user,
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
                client: client,
                lawyer: req.user,
                lastMessage: req.body.body,
                date: Date.now(),
              });

              newConversation.save().then((newConv) => {
                let message = new Message({
                  conversation: newConv._id,
                  client: req.body.to,
                  lawyer: req.user,
                  body: req.body.body,
                  sender: req.user,
                });

                req.io.sockets.emit("messages", req.body.body);

                message
                  .save()
                  .then(() => res.send("message sent"))
                  .catch((err) => console.log(err));
              });
            }
          })
          .catch((err) => console.log(err));
      })
      .catch((err) => console.log(err));
  }
);

router.post("/send-invoice", (req, res) => {
  let userEmail = req.body.email;
  let message = req.body.message;
  const msg = {
    to: "Infos.claimyourrights@gmail.com",
    from: "infos@claimyourrights.ch",
    subject: "Questions from Claim Your Rights",
    text: `${userEmail} sent a message. ${message}`,
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
                            Invoice #: 123<br>
                            Created: January 1, 2015<br>
                            Due: February 1, 2015
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
                            Next Step Webs, Inc.<br>
                            12345 Sunny Road<br>
                            Sunnyville, TX 12345
                        </td>
                        
                        <td style="padding: 5px;vertical-align: top;text-align: right;padding-bottom: 40px;">
                            Acme Corp.<br>
                            John Doe<br>
                            john@example.com
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        
        <tr class="heading">
            <td style="padding: 5px;vertical-align: top;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                Payment Method
            </td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                Check #
            </td>
        </tr>
        
        <tr class="details">
            <td style="padding: 5px;vertical-align: top;padding-bottom: 20px;">
                Check
            </td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;padding-bottom: 20px;">
                1000
            </td>
        </tr>
        
        <tr class="heading">
            <td style="padding: 5px;vertical-align: top;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                Item
            </td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;background: #eee;border-bottom: 1px solid #ddd;font-weight: bold;">
                Price
            </td>
        </tr>
        
        <tr class="item">
            <td style="padding: 5px;vertical-align: top;border-bottom: 1px solid #eee;">
                Website design
            </td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;border-bottom: 1px solid #eee;">
                $300.00
            </td>
        </tr>
        
        <tr class="item">
            <td style="padding: 5px;vertical-align: top;border-bottom: 1px solid #eee;">
                Hosting (3 months)
            </td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;border-bottom: 1px solid #eee;">
                $75.00
            </td>
        </tr>
        
        <tr class="item last">
            <td style="padding: 5px;vertical-align: top;border-bottom: none;">
                Domain name (1 year)
            </td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;border-bottom: none;">
                $10.00
            </td>
        </tr>
        
        <tr class="total">
            <td style="padding: 5px;vertical-align: top;"></td>
            
            <td style="padding: 5px;vertical-align: top;text-align: right;border-top: 2px solid #eee;font-weight: bold;">
               Total: $385.00
            </td>
        </tr>
    </table>`,
  };
  sgMail
    .send(msg)
    .then(() => res.send("success"))
    .catch((err) => console.log("Error while sending an email", err));
});

router.post("/contact-us", (req, res) => {
  let userEmail = req.body.email;
  let message = req.body.message;
  const msg = {
    to: "Infos.claimyourrights@gmail.com",
    from: "infos@claimyourrights.ch",
    subject: "Questions from Claim Your Rights",
    text: `${userEmail} sent a message. ${message}`,
  };
  sgMail
    .send(msg)
    .then(() => res.send("success"))
    .catch((err) => console.log("Error while sending an email", err));
});

router.post(
  "/request-activation",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    const file = req.files.file;
    let userEmail = "infos@claimyourrights.ch";
    const path = __dirname + `${file.name}`;

    file.mv(path, (error) => {
      if (error) {
        console.error("this ", error);
        res.writeHead(500, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ status: "error", message: error }));
        return;
      } else {
        let pathToAttachment = path;
        let attachment = fs.readFileSync(pathToAttachment).toString("base64");
        const msg = {
          to: "Infos.claimyourrights@gmail.com",
          from: userEmail,
          subject: "Approval Request",
          text: `My name is ${req.user.first_name} ${req.user.last_name}. I have attached my certificate in order to have my account activated. My email address is ${req.user.email}`,
          attachments: [
            {
              content: attachment,
              filename: file.name,
              type: "application/pdf",
              disposition: "attachment",
            },
          ],
        };
        sgMail
          .send(msg)
          .then(() => {
            // console.log("hello");
            let updated_fields = {
              approval_requested: true,
            };
            Lawyer.findOneAndUpdate({ _id: req.user._id }, updated_fields)
              .then(() => {
                res.writeHead(200, {
                  "Content-Type": "application/pdf",
                });
                setTimeout(function () {
                  fs.unlinkSync(__dirname + `${file.name}`);
                }, 10000);
                res.end(
                  JSON.stringify({ status: "success", path: "/" + file.name })
                );
              })
              .catch((err) => console.log(err));
          })
          .catch((err) => console.log("this :", err));
      }
    });
  }
);

router.get(
  "/picture",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Photo.findOne({ lawyer: req.user }).then((photo) => {
      if (photo) {
        res.contentType(photo.type);
        let clientFormat = Buffer.from(photo.data).toString("base64");
        res.send(clientFormat);
      } else {
        res.send(null);
      }
    });
  }
);

router.post(
  "/profile-picture",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let file = req.files.file;
    const path = __dirname + `${file.name}`;

    file.mv(path, (error) => {});

    // empty the collection
    Photo.remove((err) => {
      if (err) throw err;

      var imageData = fs.readFileSync(path);

      Photo.findOne({ lawyer: req.user }).then((photo) => {
        if (photo) {
          Photo.findOneAndDelete({ lawyer: req.user }).then(() => {
            // Create an Image instance
            const image = new Photo({
              type: "image/png",
              data: Buffer.from(imageData, "base64"),
              lawyer: req.user,
            });

            // Store the Image to the MongoDB
            image.save().then((img) => {
              // Find the stored image in MongoDB, then save it in a folder
              fs.unlinkSync(__dirname + `${file.name}`);
              res.send("image saved");
            });
          });
        } else {
          // Create an Image instance
          const image = new Photo({
            type: "image/png",
            data: Buffer.from(imageData, "base64"),
            lawyer: req.user,
          });

          // Store the Image to the MongoDB
          image.save().then((img) => {
            // Find the stored image in MongoDB, then save it in a folder
            fs.unlinkSync(__dirname + `${file.name}`);
            res.send("image saved");
          });
        }
      });
    });
  }
);

///// PAYMENT
const Payment = require("../../models/payment.model");
const { stringify } = require("querystring");
const stripe = require("stripe")(
  "sk_test_51ID6YEF9yH26c5FnC5HIeMHD9zWOztyjNrmHAatXpvWe6dPEvupDYudd9siU2xFSRH42yRqZkyEGaXK57FNkdmj500Sd6TgjQK"
);

router.get(
  "/create-customer",
  passport.authenticate("LawyerStrategy", { session: false }),
  async (req, res) => {
    let name = req.user.first_name + " " + req.user.last_name;
    let email = req.user.email;

    var createCustomer = function (email, name) {
      var param = {};
      param.email = email;
      param.name = name;
      param.description = "from node";

      let data = [];

      Lawyer.findOne({ email: email }).then((law) => {
        Payment.findOne({ lawyer: law }).then((pay) => {
          if (!pay) {
            let x;
            stripe.customers.create(param, function (err, customer) {
              if (err) {
                res.send("failed");
              } else if (customer) {
                x = customer["id"];

                Lawyer.findOne({ email: email })
                  .then((lawyer) => {
                    let newPayment = new Payment({
                      lawyer: lawyer,
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
              } else {
                res.send("failed");
              }
            });
          } else return null;
        });
      });
    };
    createCustomer(email, name);
  }
);

router.post(
  "/create-token",
  passport.authenticate("LawyerStrategy", { session: false }),
  async (req, res) => {
    var createToken = function (email, cardNumber, exp_month, exp_year, cvc) {
      var param = {};
      param.card = {
        number: cardNumber,
        exp_month: exp_month,
        exp_year: exp_year,
        cvc: cvc,
      };

      Lawyer.findOne({ email: email })
        .then((client) => {
          Payment.findOne({ lawyer: client })
            .then((pay) => {
              stripe.tokens.create(param, function (err, token) {
                if (err) {
                  res.send("failed");
                } else if (token) {
                  let updated_fields = {
                    token_id: token["id"],
                  };

                  Payment.findOneAndUpdate({ lawyer: client }, updated_fields)
                    .then(() => res.send("success"))
                    .catch((err) => console.log(err));
                } else {
                  res.send("failed");
                }
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
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    Payment.findOne({ lawyer: req.user })
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

                  Payment.findOneAndUpdate({ lawyer: req.user }, updated_fields)
                    .then((pay) => {
                      res.send("success");
                    })
                    .catch((err) => console.log(err));
                } else {
                  res.send("failed");
                }
              }
            );
          };
          addCardToCustomer(payment.customer_id, payment.token_id);
        } else res.send("failed");
      })
      .catch((err) => console.log(err));
  }
);

router.post(
  "/withdrawal",
  passport.authenticate("LawyerStrategy", { session: false }),
  (req, res) => {
    let amount = req.body.amount;

    if (amount >= 5) {
      if (amount <= req.user.balance) {
        Payment.findOne({ lawyer: req.user })
          .then((payment) => {
            // Payout
            const payout = stripe.payouts.create({
              amount: amount,
              currency: "chf",
              method: "instant",
              destination: payment.card_id,
            });

            payout();
          })
          .catch((err) => console.log(err));
      } else res.send("insufficient");
    } else res.send("Minimum withdrawal is 5 CHF");
  }
);

module.exports = router;
