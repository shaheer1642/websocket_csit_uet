const {db} = require('../db_connection');
const validations = require('../validations');
const {DataTypes} = require('../classes/DataTypes');
const { convertUpper } = require('../functions');

class Forms {
    name = 'Forms';
    description = 'Endpoints for generating forms'
    data_types = {
        sem_course_id: new DataTypes(true,['forms/resultFormG2A'],[]).uuid,
    }
}

function resultFormG2A(data, callback) {
    console.log(`[${data.event}] called data received:`,data)
    const validator = validations.validateRequestData(data,new Forms,data.event)
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
            WHERE SMC.sem_course_id = '${data.sem_course_id}' AND SMC.teacher_id = '${data.user_id}';
        `).then(res => {
            if (res.rowCount == 0) return callback({code: 400, status: 'BAD REQUEST', message: 'Could not find matching data'})
            const data = res.rows[0]
            const attributes = {
                semester: `${data.semester_season}-${data.semester_year}`,
                department: `CS & IT`,
                course_id: data.course_id,
                credit_hours: data.credit_hours,
                course_title: data.course_name,
                instructor_name: data.teacher_name,
                date: new Date().toLocaleDateString()
            }
            return callback({
                code: 200,
                data: `
                    <html>
                        <body>
                            <button type="button" onClick="print()">Print Form</button>
                            <h3 align="right"><u>FORM G-2A</u></h2>
                            <h2 align="center">RESULT SHEET</h2>
                            <h4>
                                SEMESTER <u>${convertUpper(attributes.semester)}</u> DEPARTMENT <u>${attributes.department}</u>
                            </h4>
                            <h4>
                                COURSE NO <u>${attributes.course_id}</u> CREDIT HOURS <u>${attributes.credit_hours}</u>
                                
                            <h4>
                                COURSE TITLE <u>${attributes.course_title}</u>
                            </h4>
                            <h4>
                                DATE <u>${attributes.date}</u> SIGNATURE <u></u>
                            </h4>
                            <h4 align="right">
                                <b><u>${attributes.instructor_name}</u></b>
                            </h4>
                            <h4 align="right">(NAME IN BOLD LETTERS)</h4>
                        </body>
                    </html>
                `
            })
        }).catch(err => {
            console.log(err)
            callback(validations.validateDBSelectQueryError(err));
        })
    }
}

module.exports = {
    resultFormG2A,
    Forms
}