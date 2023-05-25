const { db } = require('../db_connection');
const validations = require('../validations');
const { DataTypes } = require('../classes/DataTypes');
const { convertUpper } = require('../functions');
const { calculateQualityPoints, getGradePoints } = require('../grading_functions');

class Forms {
    name = 'Forms';
    description = 'Endpoints for generating forms'
    data_types = {
        sem_course_id: new DataTypes(true, ['forms/resultFormG2A','forms/resultFormG2B'], []).uuid,
    }
}

function resultFormG2A(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new Forms, data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400,
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`
            SELECT * FROM semesters_courses SMC
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN students_courses SDC ON SMC.sem_course_id = SDC.sem_course_id
            JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
            JOIN students S ON S.student_id = SDB.student_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN teachers T ON T.teacher_id = SMC.teacher_id
            JOIN grades G ON SDC.grade = G.grade
            WHERE SMC.sem_course_id = '${data.sem_course_id}' AND SMC.teacher_id = '${data.user_id}';
        `).then(res => {
            if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: 'Could not find matching data' })
            const data = res.rows[0]
            const attributes = {
                semester: `${data.semester_season}-${data.semester_year}`,
                department: `CS & IT`,
                course_id: data.course_id,
                credit_hours: data.credit_hours,
                course_title: data.course_name,
                instructor_name: data.teacher_name,
                date: new Date().toLocaleDateString(),
                signature: '&nbsp;'.repeat(10)
            }
            return callback({
                code: 200,
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
    </style>
    <body>
        <button type="button" onClick="print()">Print Form</button>
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
            ${res.rows.map((record,index) => {
                return `<tr>
                    <td>${index+1}</td>
                    <td>${record.student_name}</td>
                    <td>${record.student_father_name}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.grade}</td>
                    <td>${calculateQualityPoints(record.marking?.result[record?.grade_distribution?.marking?.type]?.grade, record.credit_hours)}</td>
                </tr>`
            }).join('\n')}
        </table>
        <p style="text-align:left;">
            DATE ${htmlFunctions.formatUnderlined(attributes.date)}
            <span style="float:right;">
                SIGNATURE ${htmlFunctions.formatUnderlined(attributes.signature)}
            </span>
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
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}


function resultFormG2B(data, callback) {
    console.log(`[${data.event}] called data received:`, data)
    const validator = validations.validateRequestData(data, new Forms, data.event)
    if (!validator.valid) {
        if (callback) {
            callback({
                code: 400,
                status: 'BAD REQUEST',
                message: validator.reason
            });
        }
    } else {
        db.query(`
            SELECT * FROM semesters_courses SMC
            JOIN semesters SM ON SM.semester_id = SMC.semester_id
            JOIN students_courses SDC ON SMC.sem_course_id = SDC.sem_course_id
            JOIN students_batch SDB ON SDB.student_batch_id = SDC.student_batch_id
            JOIN students S ON S.student_id = SDB.student_id
            JOIN courses C ON C.course_id = SMC.course_id
            JOIN teachers T ON T.teacher_id = SMC.teacher_id
            JOIN grades G ON SDC.grade = G.grade
            WHERE SMC.sem_course_id = '${data.sem_course_id}' AND SMC.teacher_id = '${data.user_id}';
        `).then(res => {
            if (res.rowCount == 0) return callback({ code: 400, status: 'BAD REQUEST', message: 'Could not find matching data' })
            const data = res.rows[0]
            const attributes = {
                semester_season: data.semester_season,
                semester_year: data.semester_year,
                department: `CS & IT`,
                course_id: data.course_id,
                credit_hours: data.credit_hours,
                course_title: data.course_name,
                instructor_name: data.teacher_name,
                date: new Date().toLocaleDateString(),
                signature: '&nbsp;'.repeat(10)
            }
            return callback({
                code: 200,
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
    </style>
    <body>
        <button type="button" onClick="print()">Print Form</button>
        <div class="row">
            <div class="column">
                <img class="imageCenter" width="100" height="100" src="https://upload.wikimedia.org/wikipedia/en/9/95/University_of_Engineering_and_Technology_Peshawar_logo.svg"/>
            </div>
            <div class="column">
                <h3>DIRECTORATE OF POSTGRADUATE STUDIES<br>UNIVERSITY OF ENGINEERING & TECHNOLOGY,<br>PESHAWAR</h3>
            </div>
        </div>
        <p align="right"><u>FORM G-2B</u></p>
        <h4 align="center"><u>RESULT SHEET</u></h4>
        <p style="text-align:left;">
            Semester: Fall ${data.semester_season == 'fall' ? '☑':'☐'} Spring ${data.semester_season == 'spring' ? '☑':'☐'}
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
            ${res.rows.map((record,index) => {
                return `<tr>
                    <td>${record.student_name}</td>
                    <td>${record.student_father_name}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.evaluation?.sessional?.obtained}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.evaluation?.mid_term?.obtained}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.evaluation?.final_term?.obtained}</td>
                    <td>${record.marking?.result[record?.grade_distribution?.marking?.type]?.grade}</td>
                    <td>${calculateQualityPoints(record.marking?.result[record?.grade_distribution?.marking?.type]?.grade, record.credit_hours)}</td>
                </tr>`
            }).join('\n')}
        </table>
        <p style="text-align:left;">
            Signature of Instructor ${'. '.repeat(10)}
            <span style="float:right;">
                Name of Instructor: <b><u>${attributes.instructor_name}</u></b>
            </span>
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
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

const htmlFunctions = {
    formatUnderlined: (str, options = { uppercase: undefined, bold: undefined }) => `${options.bold ? '<b>' : ''}<u>${'&nbsp;'.repeat(10)}${options.uppercase ? convertUpper(str) : str}${'&nbsp;'.repeat(10)}</u>${options.bold ? '</b>' : ''}`
}

module.exports = {
    resultFormG2A,
    resultFormG2B,
    Forms
}