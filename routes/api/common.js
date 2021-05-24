const express = require('express');
const router = express.Router();
const gravatar = require('gravatar');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const keys = require('../../config/keys');
const passport = require('passport');
const crypto = require('crypto');


//Load Input Validation
const validateRegisterInput = require('../../validation/userRegister');
//Load Input Validation
const validateLoginInput = require('../../validation/login');
const validateChangePassword = require('../../validation/new.password');


const Client = require('../../models/client.model');

router.post('/register', (req, res) => {
    const { errors } = validateLoginInput(req.body);

    const name = req.body.name
    const password = req.body.password;
    const email = req.body.email
    const role = req.body.role
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, (err, hash) => {

            if (err) throw err;

            Client.findOne({ email: email })
                .then(user => {
                    if (user) {
                        errors.user = 'User already added'
                        res.status(400).json(errors);
                    }
                    else {

                        let newClient = new Client({
                            email: email,
                            password: password
                        });

                        
                        newClient.save()
                            .then(newclient => res.send("Successfully Registered."))
                            .catch(err => console.log(err))
                    }
                });

        })
    })
})

module.exports = router;