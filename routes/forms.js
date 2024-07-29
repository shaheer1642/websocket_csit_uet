const express = require('express')
const router = express.Router()
const db = require('../modules/db')
const { validateData, isBase64 } = require('../modules/validator');
const { body, param, check, query } = require('express-validator')
const { isAdmin, hasRole } = require('../modules/auth')
const passport = require('passport');
const { validateApplicationTemplateDetailStructure } = require('../modules/validations');
const { uploadFile } = require('../modules/aws/aws');
const { escapeDBCharacters, getDepartmentIdFromCourseId, convertTimestampToSeasonYear, convertUpper } = require('../modules/functions');
const { calculateTranscript, calculateQualityPoints, getGradePoints } = require('../modules/grading_functions');

// class Courses {
//     name = 'Courses';
//     description = 'Endpoints for creating courses'
//     data_types = {
//         course_id: new DataTypes(true, ['courses/create', 'courses/update', 'courses/delete'], ['courses/fetch'], false, 'CS-103').string,
//         course_name: new DataTypes(true, ['courses/create'], ['courses/update'], false, 'Algorithms').string,
//         course_description: new DataTypes(true, [], ['courses/create', 'courses/update'], true).string,
//         department_id: new DataTypes(true, [], [], false, 'CS&IT').string,
//         course_type: new DataTypes(true, ['courses/create'], ['courses/update'], false, 'core').string,
//         credit_hours: new DataTypes(true, ['courses/create'], ['courses/update'], false, 3).number,
//         course_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
//     }
// }

router.get('/forms/resultFormG2A',
    passport.authenticate('jwt'), hasRole.bind(this, ['teacher']),
    (req, res, next) => validateData([
        query('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    (req, res) => {
        const reqData = { ...req.user, ...req.query }

        db.query(`
            SELECT * FROM semesters_courses SMC
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN students_courses SDC ON SMC.sem_course_id = SDC.sem_course_id
            JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
            JOIN students S ON S.student_id = SDB.student_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN teachers T ON T.teacher_id = SMC.teacher_id
            JOIN grades G ON SDC.grade = G.grade
            WHERE SMC.sem_course_id = '${reqData.sem_course_id}' AND SMC.teacher_id = '${reqData.user_id}';
        `).then(db_res => {
            if (db_res.rowCount == 0) return res.status(404).send('Could not find matching data')
            const data = db_res.rows[0]
            const attributes = {
                semester: `${data.semester_season}-${data.semester_year}`,
                department: `CS & IT`,
                course_id: data.course_id,
                credit_hours: data.credit_hours,
                course_title: data.course_name,
                instructor_name: data.teacher_name,
                date: new Date().toLocaleDateString('en-UK', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                signature: '&nbsp;'.repeat(10),
                digital_signature: data.digital_signature
            }
            return res.send({
                data:
                    `<html>
    <style>
        table {
            font-family: arial, sans-serif;
            border-collapse: collapse;
            width: 100%;
        }

        td, th {
            border: 1px solid #dddddd;
            text-align: left;
            padding: 8px;
        }

        .imageCenter {
            display: block;
            margin-left: auto;
            margin-right: auto;
            width: 50%;
          }

        @media print{
            .noprint{
                display:none;
            }
            @page { margin: 0; }
            body { margin: 1.6cm; }
        }
    </style>
    <body>
        <button class="noprint" type="button" onClick="print()">Print Form</button>
        <img class="imageCenter" width="100" height="100" src="https://upload.wikimedia.org/wikipedia/en/9/95/University_of_Engineering_and_Technology_Peshawar_logo.svg"/>
        <p align="right"><u>FORM G-2A</u></p>
        <h4 align="center"><u>RESULT SHEET</u></h4>
        <p>
            SEMESTER ${htmlFunctions.formatUnderlined(attributes.semester, { uppercase: true })} DEPARTMENT ${htmlFunctions.formatUnderlined(attributes.department)}
        </p>
        <p>
            COURSE NO ${htmlFunctions.formatUnderlined(attributes.course_id)} CREDIT HOURS ${htmlFunctions.formatUnderlined(attributes.credit_hours)}
        <p>
            COURSE TITLE ${htmlFunctions.formatUnderlined(attributes.course_title)}
        </p>
        <table>
            <tr>
                <th>S.NO</th>
                <th>STUDENT'S NAME</th>
                <th>FATHER'S NAME</th>
                <th>FINAL SEMESTER GRADE</th>
                <th>QUALITY POINTS</th>
            </tr>
            ${db_res.rows.map((record, index) => {
                        return `<tr>
                    <td>${index + 1}</td>
                    <td>${record.student_name}</td>
                    <td>${record.student_father_name}</td>
                    <td>${record.grade}</td>
                    <td>${calculateQualityPoints(record.grade, record.credit_hours)}</td>
                </tr>`
                    }).join('\n')}
        </table>
        <p style="text-align:left; ${attributes.digital_signature ? 'position: relative; padding-top: 25px; padding-bottom: 25px;' : ''}">
            DATE ${htmlFunctions.formatUnderlined(attributes.date)}
            <span style="float:right;">
                SIGNATURE ${htmlFunctions.formatUnderlined(attributes.signature)}
            </span>
            ${attributes.digital_signature ? `
                <img style="position: absolute; right: 50; top: 0" src='${attributes.digital_signature}' width="40px"/>
            `: ''}
        </p>
        <p align="right">
            ${htmlFunctions.formatUnderlined(attributes.instructor_name, { bold: true })}
        </p>
        <p align="right">(NAME IN BOLD LETTERS)</p>
        <table>
            <tr>
                <td>Grade</td>
                ${getGradePoints().filter(o => o.description == 'course_grade').map((obj) => `<td>${obj.grade}</td>`).join('\n')}
            </tr>
            <tr>
                <td>POINTS</td>
                ${getGradePoints().filter(o => o.description == 'course_grade').map((obj) => `<td>${obj.grade_points}</td>`).join('\n')}
            </tr>
        </table>
        <p>
            NOTE:-<br>  i)	    Quality Points = (Grade Point) x (Number of credit hrs).<br>
                    ii)	    Calculate the quality points to two places of decimal. If number at third decimal place is 5 or more, round off the second decimal points to next number. If number at third decimal place is less than 5 then keep the number as it is at second decimal point.<br>
                    iii)    Please enter the grades very carefully as these cannot be changed once award, except for 'I' grade which can be changed subject to completing the requirements for the course.         
        </p>
    </body>
</html>`
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.get('/forms/resultFormG2B',
    passport.authenticate('jwt'), hasRole.bind(this, ['teacher']),
    (req, res, next) => validateData([
        query('sem_course_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`),
    ], req, res, next),
    (req, res) => {
        const reqData = { ...req.user, ...req.query }

        db.query(`
            SELECT * FROM semesters_courses SMC
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN students_courses SDC ON SMC.sem_course_id = SDC.sem_course_id
            JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
            JOIN students S ON S.student_id = SDB.student_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN teachers T ON T.teacher_id = SMC.teacher_id
            JOIN grades G ON SDC.grade = G.grade
            WHERE SMC.sem_course_id = '${reqData.sem_course_id}' AND SMC.teacher_id = '${reqData.user_id}';
        `).then(db_res => {
            if (db_res.rowCount == 0) return res.status(404).send('Could not find matching data')
            const data = db_res.rows[0]
            const attributes = {
                semester_season: data.semester_season,
                semester_year: data.semester_year,
                department: `CS & IT`,
                course_id: data.course_id,
                credit_hours: data.credit_hours,
                course_title: data.course_name,
                instructor_name: data.teacher_name,
                date: new Date().toLocaleDateString('en-UK', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                signature: '&nbsp;'.repeat(10),
                digital_signature: data.digital_signature
            }
            return res.send({
                data:
                    `<html>
    <style>
        table {
            font-family: arial, sans-serif;
            border-collapse: collapse;
            width: 100%;
        }

        td, th {
            border: 1px solid #dddddd;
            text-align: left;
            padding: 8px;
        }

        .row {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .column {
            float: left;
        }
        
        /* Clear floats after the columns */
        .row:after {
            content: "";
            display: table;
            clear: both;
        }

        @media print{
            .noprint{
                display:none;
            }
            @page { margin: 0; }
            body { margin: 1.6cm; }
        }
    </style>
    <body>
        <button class="noprint" type="button" onClick="print()">Print Form</button>
        <div class="row">
            <div class="column" style="margin-right: 30px">
                <img width="50" height="50" src="https://upload.wikimedia.org/wikipedia/en/9/95/University_of_Engineering_and_Technology_Peshawar_logo.svg"/>
            </div>
            <div class="column">
                <h3>DIRECTORATE OF POSTGRADUATE STUDIES<br>UNIVERSITY OF ENGINEERING & TECHNOLOGY,<br>PESHAWAR</h3>
            </div>
        </div>
        <p align="right"><u>FORM G-2B</u></p>
        <h4 align="center"><u>RESULT SHEET</u></h4>
        <p style="text-align:left;">
            Semester: Fall ${data.semester_season == 'fall' ? '☑' : '☐'} Spring ${data.semester_season == 'spring' ? '☑' : '☐'}
            <span style="float:right;">
                Course Title: <u>${attributes.course_title}</u>
            </span>
        </p>
        <p style="text-align:left;">
            Year: <u>${data.semester_year}</u>
            <span style="float:right;margin-left: 15px;">
                Credit Hours: <u>${attributes.credit_hours}</u>
            </span>
            <span style="float:right;">
                Course No: <u>${attributes.course_id}</u>
            </span>
        </p>
        <table>
            <tr>
                <th>Student's Name</th>
                <th>Father's Name</th>
                <th colspan="3">Breakdown of Marks<br><span style="font-size: 12px">(Marks can be distributed over quizzes, home assignments, mid-term exam, short projects etc.)</span></th>
                <th>Final Semester Grade</th>
                <th>Quality Points</th>
            </tr>
            <tr>
                <th></th>
                <th></th>
                <th><span style="font-size: 12px"><u>Sessional<br>(${data?.marking?.result[data?.grade_distribution?.marking?.type]?.evaluation?.sessional?.total})</u></span></th>
                <th><span style="font-size: 12px"><u>Mid Term<br>(${data?.marking?.result[data?.grade_distribution?.marking?.type]?.evaluation?.mid_term?.total})</u></span></th>
                <th><span style="font-size: 12px"><u>Final Term<br>(${data?.marking?.result[data?.grade_distribution?.marking?.type]?.evaluation?.final_term?.total})</u></span></th>
                <th></th>
                <th></th>
            </tr>
            ${db_res.rows.map((record, index) => {
                        return `<tr>
                    <td>${record.student_name}</td>
                    <td>${record.student_father_name}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.evaluation?.sessional?.obtained}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.evaluation?.mid_term?.obtained}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.evaluation?.final_term?.obtained}</td>
                    <td>${record.grade}</td>
                    <td>${calculateQualityPoints(record.grade, record.credit_hours)}</td>
                </tr>`
                    }).join('\n')}
        </table>
        <p style="text-align:left; ${attributes.digital_signature ? 'position: relative; padding-top: 25px; padding-bottom: 25px;' : ''}">
            Signature of Instructor ${'. '.repeat(10)}
            <span style="float:right;">
                Name of Instructor: <b><u>${attributes.instructor_name}</u></b>
            </span>
            ${attributes.digital_signature ? `
                <img style="position: absolute; left: 170; top: 0" src='${attributes.digital_signature}' width="40px"/>
            `: ''}
        </p>
        <p style="text-align:left;">
            Department <u>CS & IT</u>
            <span style="float:right;">
                Date: <u>${attributes.date}</u>
            </span>
        </p>
        <table>
            <tr>
                <td>Grade</td>
                ${getGradePoints().filter(o => o.description == 'course_grade').map((obj) => `<td>${obj.grade}</td>`).join('\n')}
            </tr>
            <tr>
                <td>POINTS</td>
                ${getGradePoints().filter(o => o.description == 'course_grade').map((obj) => `<td>${obj.grade_points}</td>`).join('\n')}
            </tr>
        </table>
        <p>
            NOTE:-<br>  i)	    Quality Points = (Grade Point) x (Number of credit hrs).<br>
                    ii)	    Calculate the quality points to two places of decimal. If number at third decimal place is 5 or more, round off the second decimal points to next number. If number at third decimal place is less than 5 then keep the number as it is at second decimal point.<br>
                    iii)    Please enter the grades very carefully as these cannot be changed once award, except for 'I' grade which can be changed subject to completing the requirements for the course.         
        </p>
    </body>
</html>`
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

router.get('/forms/studentTranscript',
    passport.authenticate('jwt'), hasRole.bind(this, ['admin', 'pga', 'student', 'dpgs']),
    (req, res, next) => validateData([
        query('student_batch_id').isUUID().withMessage((value, { path }) => `Invalid value "${value}" provided for field "${path}"`)
    ], req, res, next),
    (req, res) => {
        const reqData = req.query

        db.query(`
            SELECT * FROM students_courses SDC
            JOIN semesters_courses SMC ON SMC.sem_course_id = SDC.sem_course_id
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
            JOIN batches B ON SDB.batch_id = B.batch_id
            JOIN students S ON S.student_id = SDB.student_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN grades G ON SDC.grade = G.grade
            WHERE SDC.student_batch_id = '${reqData.student_batch_id}'
            ORDER BY SM.semester_start_timestamp ASC;
            SELECT * FROM students_thesis WHERE student_batch_id = '${reqData.student_batch_id}';
        `).then(db_res => {
            if (db_res[0].rowCount == 0) return res.send({ data: '<html><body><h4>No courses assigned yet</h4></body></html>' })
            const courses = db_res[0].rows
            const thesis = db_res[1].rows[0]
            const data = courses[0]
            const attributes = {
                reg_no: data.reg_no?.toUpperCase(),
                cnic: data.cnic,
                student_name: data.student_name,
                student_father_name: data.student_father_name,
                degree_type: data.degree_type,
                department: `Computer Science & Information Technology`,
                specialization: convertUpper(data.batch_stream),
                date: new Date().toLocaleDateString('en-UK', { year: 'numeric', month: '2-digit', day: '2-digit' }),
            }
            const { semestersCourses, gpa } = calculateTranscript(courses)
            return res.send({
                data:
                    `<html>
    <style>
        table {
            font-family: arial, sans-serif;
            font-size: 12px;
            border-collapse: collapse;
            width: 100%;
        }

        td, th {
            border: 1px solid black;
            text-align: left;
            padding: 8px;
        }

        .row {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .column {
            float: left;
        }
        
        /* Clear floats after the columns */
        .row:after {
            content: "";
            display: table;
            clear: both;
        }

        .grid-container {
            display: grid;
            grid-template-columns: auto auto auto;
            justify-content: space-around;
        }
        .grid-item {
            text-align: center;
        }

        @media print{
            .noprint{
                display:none;
            }
            @page { margin: 0; }
            body { margin: 1.6cm; }
        }
    </style>
    <body>
        <button class="noprint" type="button" onClick="print()">Print Form</button>
        <div class="row">
            <div class="column" style="margin-right: 30px">
                <img width="100" height="100" src="https://upload.wikimedia.org/wikipedia/en/9/95/University_of_Engineering_and_Technology_Peshawar_logo.svg"/>
            </div>
            <div class="column">
                <center><h3>UNIVERSITY OF ENGINEERING & TECHNOLOGY<br>PESHAWAR, PAKISTAN</h3></center>
                <center><h5>TRANSCRIPT FOR POST GRADUATE STUDIES<br>${attributes.degree_type == 'ms' ? 'MASTER OF SCIENCE' : attributes.degree_type == 'phd' ? 'DOCTOR OF PHILOSOPHY' : '<invalid-degree-type>'} IN ${attributes.specialization.toUpperCase()}</h5></center>
            </div>
        </div>

        <table style="border: none;">
            <tr style="border: none;">
                <td style="border: none;">Student's Name</td>
                <td style="border: none;">${htmlFunctions.formatUnderlined(attributes.student_name, { bold: true, line_length: 60 })}</td>
            </tr>
            <tr style="border: none;">
                <td style="border: none;">Father's Name</td>
                <td style="border: none;">${htmlFunctions.formatUnderlined(attributes.student_father_name, { bold: true, line_length: 60 })}</td>
            </tr>
            <tr style="border: none;">
                <td style="border: none;">National Identity Card No.</td>
                <td style="border: none;">${htmlFunctions.formatUnderlined(attributes.cnic || 'N/A', { bold: true, line_length: 60 })}</td>
            </tr>
            <tr style="border: none;">
                <td style="border: none;">Department</td>
                <td style="border: none;">${htmlFunctions.formatUnderlined(attributes.department, { bold: true, line_length: 60 })}</td>
            </tr>
            <tr style="border: none;">
                <td style="border: none;">Specialization</td>
                <td style="border: none;">${htmlFunctions.formatUnderlined(attributes.specialization, { bold: true, line_length: 60 })}</td>
            </tr>
            <tr style="border: none;">
                <td style="border: none;">Registration Number</td>
                <td style="border: none;">${htmlFunctions.formatUnderlined(attributes.reg_no || 'N/A', { bold: true, line_length: 60 })}</td>
            </tr>
        </table>

        <table>
            <tr>
                <th style="text-align: center">Semester</th>
                <th style="text-align: center">Course No</th>
                <th style="text-align: center">Course Title</th>
                <th style="text-align: center">Credit Hours</th>
                <th style="text-align: center">Grade</th>
                <th style="text-align: center">Quality Points</th>
            </tr>
            ${Object.keys(semestersCourses).map((semester_id, oi) => {
                        const data = semestersCourses[semester_id].courses[0]
                        const result = semestersCourses[semester_id].result
                        return semestersCourses[semester_id].courses.map((semesterCourse, ii) =>
                            `<tr>
                        <td>${ii == 0 ? `${convertUpper(data.semester_season)} ${data.semester_year}` : ''}</td>
                        <td>${semesterCourse.course_id.split('-')[0]}-${semesterCourse.course_id.split('-')[1]}</td>
                        <td>${semesterCourse.is_repeat ? '*' : ''}${semesterCourse.course_name} ${semesterCourse.is_repeat ? '(RPT)' : ''}</td>
                        <td style="text-align: center;">${semesterCourse.credit_hours}</td>
                        <td style="text-align: center;">${semesterCourse.grade}</td>
                        <td style="text-align: center;">${calculateQualityPoints(semesterCourse.grade, semesterCourse.credit_hours)}</td>
                    </tr>`
                        ).join('\n')
                    }).join('\n')}
            ${attributes.degree_type == 'ms' ?
                        `<tr>
                <td>${thesis?.completion_timestamp ? convertTimestampToSeasonYear(thesis.completion_timestamp) : ''}</td>
                <td>CS-5199</td>
                <td>Master's Thesis</td>
                <td style="text-align: center;">${thesis?.thesis_type == 'research' ? '6' : thesis?.thesis_type == 'project' ? '3' : ''}</td>
                <td style="text-align: center;">${thesis?.grade || ''}</td>
                <td style="text-align: center;">---</td>
            </tr>` : ''}
        </table>

        <p style="font-size: 10px">Errors and omissions are subject to subsequent rectification</p>
        <p>Grade Point Average = <b><u>${gpa}</u></b></p>
        <p>Thesis Title ${htmlFunctions.formatUnderlined(`"${thesis?.thesis_title || 'N/A'}"`)}</p>
        <p>Transcript Prepared By: ${htmlFunctions.formatUnderlined('')}</p>
        <p>Transcript Checked By: ${htmlFunctions.formatUnderlined('')}</p>
        <p>Date of issue: ${htmlFunctions.formatUnderlined(attributes.date)}</p>
        <p align="right"><b>Controller of Examinations</b></p>
    </body>
</html>`
            })
        }).catch(err => {
            console.error(err)
            res.status(500).send(err.detail || err.message || JSON.stringify(err))
        })
    }
)

const htmlFunctions = {
    formatUnderlined: (str, options = { uppercase: undefined, bold: undefined, line_length: undefined }) =>
        `${options.bold ? '<b>' : ''}<u>${'&nbsp;'.repeat(options.line_length ? options.line_length - str.length : 10)}${options.uppercase ? convertUpper(str) : str}${'&nbsp;'.repeat(options.line_length ? options.line_length - str.length : 10)}</u>${options.bold ? '</b>' : ''}`
}

module.exports = router