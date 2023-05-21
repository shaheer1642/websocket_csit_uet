const events = require('./events')
const batches = require('./batches')
const users = require('./users')
const students = require('./students')
const teachers = require('./teachers')
const courses = require('./courses')
const semestersCourses = require('./semestersCourses')
const studentsCourses = require('./studentsCourses')
const studentsThesis = require('./studentsThesis')
const semesters = require('./semesters')
const login = require('./login')
const autocomplete = require('./autocomplete')
const documents = require('./documents')
const instructions = require('./instructions')
const applications = require('./applications')
const applicationsTemplates = require('./applicationsTemplates')

class Endpoint {
    constructor(endpoint, class_object , response_example, is_authorized, permission_level, listener_function) {
        this.call_example = `socket.emit("${endpoint}", <pre><code>${JSON.stringify(class_object ? Object.keys(class_object.data_types).reduce((o, key) => class_object.data_types[key].required.includes(endpoint) ? ({ ...o, [key]: class_object.data_types[key].example_value}):({...o}), {}) : {},null,4) }</code></pre>, (res) => console.log(res))`;
        this.response_example = response_example;
        this.is_authorized = is_authorized;
        this.permission_level = permission_level;
        this.listener_function = listener_function;
    }
}
class ListenerEndpoint {
    constructor(description, listen_example, payload_example) {
        this.description = description;
        this.listen_example = listen_example;
        this.payload_example = payload_example;
    }
}

const endpoints = {
    autocomplete: {
        users: new Endpoint(
            "autocomplete/users",
            new autocomplete.Autocomplete(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ''},null,4)}</code></pre>`,
            false,
            ['ALL'],
            autocomplete.autocompleteUsers
        ),
        teachers: new Endpoint(
            "autocomplete/teachers",
            new autocomplete.Autocomplete(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ''},null,4)}</code></pre>`,
            false,
            ['ALL'],
            autocomplete.autocompleteTeachers
        ),
        faculty: new Endpoint(
            "autocomplete/faculty",
            new autocomplete.Autocomplete(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ''},null,4)}</code></pre>`,
            false,
            ['ALL'],
            autocomplete.autocompleteFaculty
        ),
        courses: new Endpoint(
            "autocomplete/courses",
            new autocomplete.Autocomplete(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ''},null,4)}</code></pre>`,
            false,
            ['ALL'],
            autocomplete.autocompleteCourses
        ),
        batchStudents: new Endpoint(
            "autocomplete/batchStudents",
            new autocomplete.Autocomplete(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ''},null,4)}</code></pre>`,
            false,
            ['ALL'],
            autocomplete.autocompleteBatchStudents
        ),
    },
    documents: {
        fetch: new Endpoint(
            "documents/fetch",
            new documents.Documents(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            documents.documentsFetch
        ),
        create: new Endpoint(
            "documents/create",
            new documents.Documents(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: 'added record to db', data: '${record_schema}'},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            documents.documentsCreate
        ),
        delete: new Endpoint(
            "documents/delete",
            new documents.Documents(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted document caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            documents.documentsDelete
        )
    },
    instructions: {
        fetch: new Endpoint(
            "instructions/fetch",
            new instructions.Instructions(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            instructions.instructionsFetch
        ),
        update: new Endpoint(
            "instructions/update",
            new instructions.Instructions(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            instructions.instructionsUpdate
        ),
    },
    events: {
        fetch: new Endpoint(
            "events/fetch",
            new events.Events(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            events.eventsFetch
        ),
        create: new Endpoint(
            "events/create",
            new events.Events(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            events.eventsCreate
        ),
        update: new Endpoint(
            "events/update",
            new events.Events(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated event caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            events.eventsUpdate
        ),
        delete: new Endpoint(
            "events/delete",
            new events.Events(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted event caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            events.eventsDelete
        )
    },
    batches: {
        fetch: new Endpoint(
            "batches/fetch",
            new batches.Batches(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            batches.batchesFetch
        ),
        create: new Endpoint(
            "batches/create",
            new batches.Batches(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            batches.batchesCreate
        ),
        update: new Endpoint(
            "batches/update",
            new batches.Batches(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            batches.batchesUpdate
        ),
        delete: new Endpoint(
            "batches/delete",
            new batches.Batches(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            batches.batchesDelete
        )
    },
    users: {
        fetch: new Endpoint(
            "users/fetch",
            new users.Users(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            users.usersFetch
        ),
    },
    students: {
        fetch: new Endpoint(
            "students/fetch",
            new students.Students(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            students.studentsFetch
        ),
        create: new Endpoint(
            "students/create",
            new students.Students(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            students.studentsCreate
        ),
        update: new Endpoint(
            "students/update",
            new students.Students(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            students.studentsUpdate
        ),
        delete: new Endpoint(
            "students/delete",
            new students.Students(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            students.studentsDelete
        )
    },
    teachers: {
        fetch: new Endpoint(
            "teachers/fetch",
            new teachers.Teachers(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            teachers.teachersFetch
        ),
        create: new Endpoint(
            "teachers/create",
            new teachers.Teachers(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            teachers.teachersCreate
        ),
        update: new Endpoint(
            "teachers/update",
            new teachers.Teachers(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            teachers.teachersUpdate
        ),
        delete: new Endpoint(
            "teachers/delete",
            new teachers.Teachers(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            teachers.teachersDelete
        )
    },
    courses: {
        fetch: new Endpoint(
            "courses/fetch",
            new courses.Courses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            courses.coursesFetch
        ),
        create: new Endpoint(
            "courses/create",
            new courses.Courses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            courses.coursesCreate
        ),
        update: new Endpoint(
            "courses/update",
            new courses.Courses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated CS-103 record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            courses.coursesUpdate
        ),
        delete: new Endpoint(
            "courses/delete",
            new courses.Courses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted CS-103 record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            courses.coursesDelete
        )
    },
    semesters: {
        fetch: new Endpoint(
            "semesters/fetch",
            new semesters.Semesters(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            semesters.semestersFetch
        ),
        create: new Endpoint(
            "semesters/create",
            new semesters.Semesters(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            semesters.semestersCreate
        ),
        update: new Endpoint(
            "semesters/update",
            new semesters.Semesters(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            semesters.semestersUpdate
        ),
        delete: new Endpoint(
            "semesters/delete",
            new semesters.Semesters(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            semesters.semestersDelete
        )
    },
    semestersCourses: {
        fetch: new Endpoint(
            "semestersCourses/fetch",
            new semestersCourses.SemestersCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            semestersCourses.semestersCoursesFetch
        ),
        create: new Endpoint(
            "semestersCourses/create",
            new semestersCourses.SemestersCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: 'added record to db'},null,4)}</code></pre>`,
            true,
            ['admin'],
            semestersCourses.semestersCoursesCreate
        ),
        updateTeacher: new Endpoint(
            "semestersCourses/updateTeacher",
            new semestersCourses.SemestersCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            semestersCourses.semestersCoursesUpdateTeacher
        ),
        updateGradeDistribution: new Endpoint(
            "semestersCourses/updateGradeDistribution",
            new semestersCourses.SemestersCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['teacher'],
            semestersCourses.semestersCoursesUpdateGradeDistribution
        ),
        delete: new Endpoint(
            "semestersCourses/delete",
            new semestersCourses.SemestersCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted caa1534e-da15-41b6-8110-cc3fcffb14ed record from db`},null,4)}</code></pre>`,
            true,
            ['admin'],
            semestersCourses.semestersCoursesDelete
        ),
    },
    studentsCourses: {
        fetch: new Endpoint(
            "studentsCourses/fetch",
            new studentsCourses.StudentsCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            studentsCourses.studentsCoursesFetch
        ),
        assignStudents: new Endpoint(
            "studentsCourses/assignStudents",
            new studentsCourses.StudentsCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated records in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            studentsCourses.studentsCoursesAssignStudents
        ),
        updateGrade: new Endpoint(
            "studentsCourses/updateGrade",
            new studentsCourses.StudentsCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated sem_course=caa1534e-da15-41b6-8110-cc3fcffb14ed student=caa1534e-da15-41b6-8110-cc3fcffb14ed record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga','teacher'],
            studentsCourses.studentsCoursesUpdateGrade
        ),
        updateMarkings: new Endpoint(
            "studentsCourses/updateMarkings",
            new studentsCourses.StudentsCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated records in db`},null,4)}</code></pre>`,
            true,
            ['teacher'],
            studentsCourses.studentsCoursesUpdateMarkings
        ),
        updateAttendances: new Endpoint(
            "studentsCourses/updateAttendances",
            new studentsCourses.StudentsCourses(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated records in db`},null,4)}</code></pre>`,
            true,
            ['teacher'],
            studentsCourses.studentsCoursesUpdateAttendances
        ),
    },
    studentsThesis: {
        fetch: new Endpoint(
            "studentsThesis/fetch",
            new studentsThesis.StudentsThesis(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            studentsThesis.studentsThesisFetch
        ),
        create: new Endpoint(
            "studentsThesis/create",
            new studentsThesis.StudentsThesis(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `added record to db`},null,4)}</code></pre>`,
            true,
            ['pga'],
            studentsThesis.studentsThesisCreate
        ),
        update: new Endpoint(
            "studentsThesis/update",
            new studentsThesis.StudentsThesis(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated record in db`},null,4)}</code></pre>`,
            true,
            ['pga'],
            studentsThesis.studentsThesisUpdate
        ),
        delete: new Endpoint(
            "studentsThesis/delete",
            new studentsThesis.StudentsThesis(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted record from db`},null,4)}</code></pre>`,
            true,
            ['pga'],
            studentsThesis.studentsThesisDelete
        ),
    },
    applications: {
        fetch: new Endpoint(
            "applications/fetch",
            new applications.Applications(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            true,
            ['ALL'],
            applications.applicationsFetch
        ),
        create: new Endpoint(
            "applications/create",
            new applications.Applications(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `added record to db`},null,4)}</code></pre>`,
            true,
            ['admin','pga','teacher','student'],
            applications.applicationsCreate
        ),
        updateStatus: new Endpoint(
            "applications/updateStatus",
            new applications.Applications(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga','teacher'],
            applications.applicationsUpdateStatus
        ),
        forward: new Endpoint(
            "applications/forward",
            new applications.Applications(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga','teacher'],
            applications.applicationsForward
        ),
    },
    applicationsTemplates: {
        fetch: new Endpoint(
            "applicationsTemplates/fetch",
            new applicationsTemplates.ApplicationsTemplates(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${record_schema}']},null,4)}</code></pre>`,
            true,
            ['ALL'],
            applicationsTemplates.applicationsTemplatesFetch
        ),
        create: new Endpoint(
            "applicationsTemplates/create",
            new applicationsTemplates.ApplicationsTemplates(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `added record to db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            applicationsTemplates.applicationsTemplatesCreate
        ),
        update: new Endpoint(
            "applicationsTemplates/update",
            new applicationsTemplates.ApplicationsTemplates(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `updated record in db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            applicationsTemplates.applicationsTemplatesUpdate
        ),
        delete: new Endpoint(
            "applicationsTemplates/delete",
            new applicationsTemplates.ApplicationsTemplates(),
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: `deleted record from db`},null,4)}</code></pre>`,
            true,
            ['admin','pga'],
            applicationsTemplates.applicationsTemplatesDelete
        ),
    },
    login: {
        auth: new Endpoint(
            "login/auth",
            new login.Login,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: '${record_schema}'},null,4)}</code></pre>`,
            false,
            ['ALL'],
            login.loginAuth
        ),
        resetPassword: new Endpoint(
            "login/resetPassword",
            new login.Login,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', message: 'password reset successful'},null,4)}</code></pre>`,
            false,
            ['ALL'],
            login.resetPassword
        ),
    },
    schema: {
        events: new Endpoint(
            "schema/events",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new events.Events}) : {}
        ),
        batches: new Endpoint(
            "schema/batches",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new batches.Batches}) : {}
        ),
        students: new Endpoint(
            "schema/students",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new students.Students}) : {}
        ),
        teachers: new Endpoint(
            "schema/teachers",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new teachers.Teachers}) : {}
        ),
        courses: new Endpoint(
            "schema/courses",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new courses.Courses}) : {}
        ),
        semesters: new Endpoint(
            "schema/semesters",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new semesters.Semesters}) : {}
        ),
        semestersCourses: new Endpoint(
            "schema/semestersCourses",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new semestersCourses.SemestersCourses}) : {}
        ),
        studentsCourses: new Endpoint(
            "schema/studentsCourses",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new studentsCourses.StudentsCourses}) : {}
        ),
        studentsThesis: new Endpoint(
            "schema/studentsThesis",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new studentsThesis.StudentsThesis}) : {}
        ),
        applications: new Endpoint(
            "schema/applications",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new applications.Applications()}) : {}
        ),
        applicationsTemplates: new Endpoint(
            "schema/applicationsTemplates",
            null,
            `<pre><code>${JSON.stringify({code: 200, status: 'OK', data: ['${schema_obj}']},null,4)}</code></pre>`,
            false,
            ['ALL'],
            (data,callback) => callback ? callback({code: 200, status: 'OK', data: new applicationsTemplates.ApplicationsTemplates()}) : {}
        ),
    }
}

const listener_endpoints = {
    events: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("events/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("events/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("events/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    batches: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("batches/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("batches/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("batches/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    students: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("students/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("students/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("students/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    teachers: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("teachers/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("teachers/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("teachers/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    courses: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("courses/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("courses/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("courses/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    semesters: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("semesters/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("semesters/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("semesters/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    semestersCourses: {
        listener: {
            changed: new ListenerEndpoint(
                'Triggered after a new record is inserted, updated, or deleted in the table',
                `socket.on("semestersCourses/listener/changed", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
        }
    },
    studentsCourses: {
        listener: {
            changed: new ListenerEndpoint(
                'Triggered after a new record is inserted, updated, or deleted in the table',
                `socket.on("studentsCourses/listener/changed", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    studentsThesis: {
        listener: {
            changed: new ListenerEndpoint(
                'Triggered after a new record is inserted, updated, or deleted in the table',
                `socket.on("studentsThesis/listener/changed", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    documents: {
        listener: {
            changed: new ListenerEndpoint(
                'Triggered after a new record is inserted, updated, or deleted in the table',
                `socket.on("documents/listener/changed", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    applications: {
        listener: {
            insert: new ListenerEndpoint(
                'Triggered after a new record is inserted in the table',
                `socket.on("applications/listener/insert", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            update: new ListenerEndpoint(
                'Triggered after a record is updated in the table',
                `socket.on("applications/listener/update", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            ),
            delete: new ListenerEndpoint(
                'Triggered after a record is deleted from the table',
                `socket.on("applications/listener/delete", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
    applicationsTemplates: {
        listener: {
            changed: new ListenerEndpoint(
                'Triggered after a new record is inserted, updated, or deleted in the table',
                `socket.on("applicationsTemplates/listener/changed", (data) => print(data))`,
                `<pre><code>${JSON.stringify("${record_schema}",null,4)}</code></pre>`
            )
        }
    },
}

const endpointsClasses = [
    {
        id: 'autocomplete',
        class1: new autocomplete.Autocomplete(),
        class2: endpoints.autocomplete,
    },
    {
        id: 'login',
        class1: new login.Login(),
        class2: endpoints.login,
    },
    {
        id: 'events',
        class1: new events.Events(),
        class2: endpoints.events,
        class3: listener_endpoints.events
    },
    {
        id: 'batches',
        class1: new batches.Batches(),
        class2: endpoints.batches,
    },
    {
        id: 'users',
        class1: new users.Users(),
        class2: endpoints.users,
    },
    {
        id: 'students',
        class1: new students.Students(),
        class2: endpoints.students,
        class3: listener_endpoints.students
    },
    {
        id: 'teachers',
        class1: new teachers.Teachers(),
        class2: endpoints.teachers,
        class3: listener_endpoints.teachers
    },
    {
        id: 'courses',
        class1: new courses.Courses(),
        class2: endpoints.courses,
        class3: listener_endpoints.courses
    },
    {
        id: 'semesters',
        class1: new semesters.Semesters(),
        class2: endpoints.semesters,
        class3: listener_endpoints.semesters
    },
    {
        id: 'semestersCourses',
        class1: new semestersCourses.SemestersCourses(),
        class2: endpoints.semestersCourses,
        class3: listener_endpoints.semestersCourses
    },
    {
        id: 'studentsCourses',
        class1: new studentsCourses.StudentsCourses(),
        class2: endpoints.studentsCourses,
        class3: listener_endpoints.studentsCourses
    },
    {
        id: 'studentsThesis',
        class1: new studentsThesis.StudentsThesis(),
        class2: endpoints.studentsThesis,
        class3: listener_endpoints.studentsThesis
    },
    {
        id: 'documents',
        class1: new documents.Documents(),
        class2: endpoints.documents,
        class3: listener_endpoints.documents
    },
    {
        id: 'instructions',
        class1: new instructions.Instructions(),
        class2: endpoints.instructions,
    },
    {
        id: 'applications',
        class1: new applications.Applications(),
        class2: endpoints.applications,
        class3: listener_endpoints.applications
    },
    {
        id: 'applicationsTemplates',
        class1: new applicationsTemplates.ApplicationsTemplates(),
        class2: endpoints.applicationsTemplates,
        class3: listener_endpoints.applicationsTemplates
    }
]

function getEndpoints() {
    var string = ''

    string += endpointsClasses.map(e => `<a style="font-size: 22px;" href="#${e.id}">${e.id}</a>`).join('<br>')

    for (const endpoint of endpointsClasses) {
        string += processWebPage(endpoint)
    }
    
    string = string.replace(/<h1>/g,'<h1 style="color: #30bf64">')
    string = string.replace(/<h3>/g,'<h3 style="color: #3269c2">')
    string = string.replace(/<table>/g,'<table style="border: 2px solid black">')
    string = string.replace(/<th>/g,'<th style="border: 1px solid black;border-collapse: collapse;padding: 15px;">')
    string = string.replace(/<td>/g,'<td style="border: 1px solid black;border-collapse: collapse;padding: 15px;">')

    return string
}

function processWebPage(classes) {
    const id = classes.id
    const class1 = classes.class1
    const class2 = classes.class2
    const class3 = classes.class3
    var string = ''

    string += `<center><h1 id="${id}">${class1.name}</h1></center>`

    string += `<h3>Description</h3>`
    string += `<p style="font-size:20px">${class1.description}</p>`

    string += `<h3>Record Schema</h3>`
    var schema = {}
    for (const key in class1.data_types) {
        const field = class1.data_types[key]
        if (field.attribute) {
            schema[key] = field.type
        }
    }
    string += `<p style="font-size:20px"><pre><code>${JSON.stringify(schema, null, 4)}</code></pre></p>`

    string += `<h3>Schema detail</h3>`
    string += `<table><tr><th>Key</th><th>Data type</th><th>Example value</th></tr>`
    for (const key in class1.data_types) {
        const field = class1.data_types[key]
        if (field.required || field.optional) {
            string += `<tr>
                <td>${key}</td>
                <td>${field.type}</td>
                <td>${field.example_value}</td>
            </tr>`
        }
    }
    string += `</table>`

    string += `<h3>Endpoints</h3>`
    string += `<p>All endpoints response contain code, status and message fields.<br>code 200 means response is good<br>code 400 means there was an error in submitted request<br>code 500 means there was an internal server error</p>`
    string += `<table><tr><th>Endpoint</th><th>Permission level</th><th>Required keys</th><th>Optional keys</th><th>Call example</th><th>Response example</th></tr>`
    
    for (const key in class2) {
        const ep2 = class2[key]
        const event = `${id}/${key}`
        string += `<tr><td>${event}</td><td>${ep2.permission_level}</td>`

        string += `<td>`
        for (const key in class1.data_types) {
            const field = class1.data_types[key]
            if (field.required?.includes(event))
                string += `${key}<br>`
        }
        string += `</td>`
        
        string += `<td>`
        for (const key in class1.data_types) {
            const field = class1.data_types[key]
            if (field.optional?.includes(event))
                string += `${key}<br>`
        }
        string += `</td>`
        string += `<td>${ep2.call_example}</td>`
        string += `<td>${ep2.response_example.replaceAll('${record_schema}',JSON.stringify(schema,null,8))}</td>`
        string += `</tr>`
    }
    string += `</table>`

    if (class3) {
        string += `<h3>Real-time Events</h3>`
        string += `<p>All listeners contain a record schema`
        string += `<table><tr><th>Listener</th><th>Description</th><th>Listen example</th><th>Payload example</th></tr>`
        for (const key in class3.listener) {
            const listener = class3.listener[key]
            string += `<tr><td>${id}/listener/${key}</td>`
            string += `<td>${listener.description}</td>`
            string += `<td>${listener.listen_example}</td>`
            string += `<td>${listener.payload_example.replaceAll('${record_schema}',JSON.stringify(schema,null,8))}</td>`
            string += `</tr>`
        }
        string += `</table>`
    }
    return string
}

module.exports = {
    endpoints,
    listener_endpoints,
    getEndpoints
}