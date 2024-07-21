const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');
const { DataTypes } = require('../modules/classes/DataTypes');

// class Departments {
//     name = 'Departments';
//     description = 'Endpoints for creating student batches'
//     data_types = {
//         serial: new DataTypes(true).autonumber,
//         department_id: new DataTypes(true, ['departments/updateChairman'], ['departments/fetch'], false, 'CS&IT').string,
//         department_name: new DataTypes(true, [], [], false, 'Computer Science & Information Technology').string,
//         chairman_id: new DataTypes(true, ['departments/updateChairman'], []).uuid,
//     }
// }

router.get('/schema/courses',
    (req, res) => {
        class Courses {
            name = 'Courses';
            description = 'Endpoints for creating courses'
            data_types = {
                course_id: new DataTypes(true, ['courses/create', 'courses/update', 'courses/delete'], ['courses/fetch'], false, 'CS-103').string,
                course_name: new DataTypes(true, ['courses/create'], ['courses/update'], false, 'Algorithms').string,
                course_description: new DataTypes(true, [], ['courses/create', 'courses/update'], true).string,
                department_id: new DataTypes(true, [], [], false, 'CS&IT').string,
                course_type: new DataTypes(true, ['courses/create'], ['courses/update'], false, 'core').string,
                credit_hours: new DataTypes(true, ['courses/create'], ['courses/update'], false, 3).number,
                course_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
            }
        }

        res.send(new Courses())
    }
)

module.exports = router