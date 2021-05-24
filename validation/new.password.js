const Validator = require('validator');
const isEmpty = require('./is-Empty');
module.exports = function validationChangePassword(data){
    let errors = {};

    data.email = !isEmpty(data.email) ? data.email: '';
    data.password = !isEmpty(data.password) ? data.password: '';


    if(!Validator.isEmail(data.email)){
        errors.email = 'Mismatch';    
    }

    return {
        errors,
        isValid: isEmpty(errors)
    }
}