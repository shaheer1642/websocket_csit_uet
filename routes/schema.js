const express = require('express')
const router = express.Router()
const { DataTypes } = require('../modules/classes/DataTypes');

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

router.get('/schema/teachers',
    (req, res) => {

        class Teachers {
            name = 'Teachers';
            description = 'Endpoints for creating teacher'
            data_types = {
                teacher_id: new DataTypes(true, ['teachers/update', 'teachers/delete'], ['teachers/fetch']).uuid,
                cnic: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, '1730155555555').string,
                teacher_name: new DataTypes(true, ['teachers/create'], ['teachers/update']).string,
                teacher_gender: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
                digital_signature: new DataTypes(true, [], ['teachers/update'], false, 'image-buffer').any,
                areas_of_interest: new DataTypes(true, [], ['teachers/update']).array,
                teacher_department_id: new DataTypes(true, ['teachers/create'], ['teachers/update']).string,
                qualification: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
                designation: new DataTypes(true, [], ['teachers/create', 'teachers/update'], false, 'male').string,
                teacher_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
                user_id: new DataTypes(true).uuid,
                username: new DataTypes(true).string,
                password: new DataTypes(true).string,
                user_type: new DataTypes(true).string,
                user_email: new DataTypes(true, [], ['teachers/update', 'teachers/create']).email,
            }
        }

        res.send(new Teachers())
    }
)

router.get('/schema/students',
    (req, res) => {

        class Students {
            name = 'Students';
            description = 'Endpoints for creating student'
            data_types = {
                serial: new DataTypes(true).autonumber,
                student_id: new DataTypes(true, ['students/update', 'students/delete'], ['students/fetch']).uuid,
                cnic: new DataTypes(true, [], ['students/create', 'students/update'], false, '1730155555555').string,
                reg_no: new DataTypes(true, [], ['students/create', 'students/update'], false, '19pwbcs0000').string,
                student_name: new DataTypes(true, ['students/create'], ['students/update']).string,
                student_father_name: new DataTypes(true, ['students/create'], ['students/update']).string,
                student_gender: new DataTypes(true, [], ['students/create', 'students/update'], false, 'male').string,
                student_admission_status: new DataTypes(true, [], ['students/create', 'students/update'], false, 'open_merit').string,
                student_contact_no: new DataTypes(true, [], ['students/create', 'students/update'], false, '03123456789').string,
                student_address: new DataTypes(true, [], ['students/update', 'students/create'], false, 'street#5, abc road, abc area, xyz city').string,
                student_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
                user_email: new DataTypes(true, [], ['students/update', 'students/create']).email,
                user_id: new DataTypes(true).uuid,
                username: new DataTypes(true).string,
                password: new DataTypes(true).string,
                user_type: new DataTypes(true).string,
                student_batch_id: new DataTypes(true, ['students/completeDegree', 'students/extendDegreeTime', 'students/transcript', 'students/freezeSemester', 'students/cancelAdmission'], ['students/fetch']).uuid,
                batch_id: new DataTypes(true, ['students/create', 'students/update', 'students/delete'], ['students/fetch']).uuid,
                degree_extension_periods: new DataTypes(true, [], []).array,
                degree_extension_period: new DataTypes(false, [], ['students/extendDegreeTime'], false, `{period: 'number in milliseconds', reason: 'string'}`).json,
                batch_no: new DataTypes(true).string,
                joined_semester: new DataTypes(true).string,
                degree_type: new DataTypes(true).string,
                degree_completed: new DataTypes(true, ['students/completeDegree']).boolean,
                semester_frozen: new DataTypes(true, ['students/freezeSemester']).boolean,
                admission_cancelled: new DataTypes(true, ['students/cancelAdmission']).boolean,
            }
        }

        res.send(new Students())
    }
)

router.get('/schema/events',
    (req, res) => {

        class Events {
            name = 'Events';
            description = 'Endpoints for creating news & events to be displayed on the main webpage'
            data_types = {
                serial: new DataTypes(true).autonumber,
                event_id: new DataTypes(true, ['events/update', 'events/delete'], ['events/fetch']).uuid,
                title: new DataTypes(true, ['events/create'], ['events/update']).string,
                body: new DataTypes(true, ['events/create'], ['events/update'], true).string,
                event_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
                event_expiry_timestamp: new DataTypes(true, [], ['events/create', 'events/update']).unix_timestamp_milliseconds,
                record_limit: new DataTypes(false, [], ['events/fetch']).number
            }
        }

        res.send(new Events())
    }
)

router.get('/schema/batches',
    (req, res) => {

        class Batches {
            name = 'Batches';
            description = 'Endpoints for creating student batches'
            data_types = {
                serial: new DataTypes(true).autonumber,
                batch_id: new DataTypes(true, ['batches/update', 'batches/delete'], ['batches/fetch']).uuid,
                batch_advisor_id: new DataTypes(true, [], ['batches/create', 'batches/update']).uuid,
                batch_no: new DataTypes(true, ['batches/create'], ['batches/update'], false, 3).number,
                batch_stream: new DataTypes(true, ['batches/create'], ['batches/update'], false, 3).string,
                enrollment_year: new DataTypes(true, ['batches/create'], ['batches/update'], false, 2022).number,
                enrollment_season: new DataTypes(true, ['batches/create'], ['batches/update'], false, 'spring').string,
                degree_type: new DataTypes(true, ['batches/create'], ['batches/update'], false, 'msc').string,
                batch_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
                batch_expiration_timestamp: new DataTypes(true, ['batches/create'], ['batches/update']).unix_timestamp_milliseconds,
            }
        }

        res.send(new Batches())
    }
)

router.get('/schema/semesters',
    (req, res) => {

        class Semesters {
            name = 'Semesters';
            description = 'Endpoints for creating semesters for batches'
            data_types = {
                semester_id: new DataTypes(true, ['semesters/update', 'semesters/delete'], ['semesters/fetch']).uuid,
                semester_year: new DataTypes(true, ['semesters/create'], ['semesters/update'], false, 2020).number,
                semester_season: new DataTypes(true, ['semesters/create'], ['semesters/update'], false, 'fall').string,
                semester_start_timestamp: new DataTypes(true, ['semesters/create'], ['semesters/update']).unix_timestamp_milliseconds,
                semester_end_timestamp: new DataTypes(true, ['semesters/create'], ['semesters/update']).unix_timestamp_milliseconds,
                semester_coordinator_id: new DataTypes(true, [], ['semesters/update', 'semesters/create']).uuid,
                student_batch_id: new DataTypes(false, [], ['semesters/fetch']).uuid,
            }
        }

        res.send(new Semesters())
    }
)

router.get('/schema/semestersCourses',
    (req, res) => {

        class SemestersCourses {
            name = 'Semesters Courses';
            description = 'Endpoints for creating semester courses'
            data_types = {
                sem_course_id: new DataTypes(true, ['semestersCourses/updateTeacher', 'semestersCourses/updateGradeDistribution', 'semestersCourses/delete', 'semestersCourses/lockChanges', 'semestersCourses/lockGrades', 'semestersCourses/unlockGrades'], ['semestersCourses/fetch']).uuid,
                course_id: new DataTypes(true, ['semestersCourses/create'], ['semestersCourses/fetch'], false, 'CS-103').string,
                teacher_id: new DataTypes(true, ['semestersCourses/create', 'semestersCourses/updateTeacher'], ['semestersCourses/fetch']).uuid,
                semester_id: new DataTypes(true, ['semestersCourses/create'], ['semestersCourses/fetch']).uuid,
                grade_distribution: new DataTypes(true, ['semestersCourses/updateGradeDistribution'], [], false, '{"finals": 50, "mids": 30, "sessional": 20, "assignments_distribution": [5,5,5], "quizzes_distribution": [5,5,5], "mini_project_distribution": 0}').json,
                changes_locked: new DataTypes(true, [], []).boolean,
                grades_locked: new DataTypes(true, [], []).boolean,
            }
        }

        res.send(new SemestersCourses())
    }
)

router.get('/schema/studentsCourses',
    (req, res) => {

        class StudentsCourses {
            name = 'Students Courses';
            description = 'Endpoints for assigning courses to students'
            data_types = {
                sem_course_id: new DataTypes(true,
                    ['studentsCourses/updateGrade', 'studentsCourses/assignStudents', 'studentsCourses/updateMarkings', 'studentsCourses/updateAttendances'],
                    ['studentsCourses/fetch']).uuid,
                student_batch_id: new DataTypes(true,
                    ['studentsCourses/updateGrade'],
                    ['studentsCourses/fetch']).uuid,
                student_batch_ids: new DataTypes(false,
                    ['studentsCourses/assignStudents'],
                    [], false, '["caa1534e-da15-41b6-8110-cc3fcffb14ed"]').array,
                grade: new DataTypes(true,
                    ['studentsCourses/updateGrade'],
                    ['studentsCourses/fetch'], false, 'B').string,
                grade_change_logs: new DataTypes(true, [], [], false, '["timestamp user_id grade"]').array,
                marking: new DataTypes(true).json,
                markings: new DataTypes(true, ['studentsCourses/updateMarkings']).array,
                attendance: new DataTypes(true).json,
                attendances: new DataTypes(true, ['studentsCourses/updateAttendances']).array,
            }
        }

        res.send(new StudentsCourses())
    }
)

router.get('/schema/studentsThesis',
    (req, res) => {

        class StudentsThesis {
            name = 'Students Thesis';
            description = 'Endpoints for assigning thesis to students'
            data_types = {
                student_batch_id: new DataTypes(true, ['studentsThesis/create', 'studentsThesis/updateGrade', 'studentsThesis/update', 'studentsThesis/delete'], ['studentsThesis/fetch']).uuid,
                thesis_type: new DataTypes(true, ['studentsThesis/create'], ['studentsThesis/fetch', 'studentsThesis/update']).string,
                thesis_title: new DataTypes(true, ['studentsThesis/create'], ['studentsThesis/update']).string,
                grade: new DataTypes(true, ['studentsThesis/updateGrade'], ['studentsThesis/fetch'], false, 'B').string,
                completion_timestamp: new DataTypes(true, ['studentsThesis/updateGrade'], []).unix_timestamp_milliseconds,
                undertaking_timestamp: new DataTypes(true, [], []).unix_timestamp_milliseconds,

                supervisor_id: new DataTypes(true, [], ['studentsThesis/create', 'studentsThesis/fetch', 'studentsThesis/update']).uuid,
                co_supervisor_id: new DataTypes(true, [], ['studentsThesis/create', 'studentsThesis/update']).uuid,
                internal_examiner: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                external_examiner: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                examiner_within_department: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                examiner_outside_department: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                examiner_outside_university: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                examiner_from_industry: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                foreign_thesis_evaluator_1: new DataTypes(true, [], ['studentsThesis/update']).uuid,
                foreign_thesis_evaluator_2: new DataTypes(true, [], ['studentsThesis/update']).uuid,

                boasar_notification_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                qe_notification_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                fe_notification_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                rec_notification_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                rec_i_meeting_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                rec_ii_meeting_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                rec_iii_meeting_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                proposal_submission_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                committee_notification_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,
                defense_day_timestamp: new DataTypes(true, [], ['studentsThesis/update']).unix_timestamp_milliseconds,

                phase_0_documents: new DataTypes(true, [], ['studentsThesis/update']).array,
                phase_1_documents: new DataTypes(true, [], ['studentsThesis/update']).array,
                phase_2_documents: new DataTypes(true, [], ['studentsThesis/update']).array,
                phase_3_documents: new DataTypes(true, [], ['studentsThesis/update']).array,
                phase_4_documents: new DataTypes(true, [], ['studentsThesis/update']).array,
                phase_5_documents: new DataTypes(true, [], ['studentsThesis/update']).array,
            }
        }

        res.send(new StudentsThesis())
    }
)

router.get('/schema/applications',
    (req, res) => {

        class Applications {
            name = 'Applications';
            description = 'Endpoints for creating/forwarding applications'
            data_types = {
                application_id: new DataTypes(true, ['applications/forward', 'applications/updateStatus'], ['applications/fetch']).uuid,
                application_title: new DataTypes(true, ['applications/create'], []).string,
                submitted_by: new DataTypes(true, [], ['applications/fetch']).uuid,
                submitted_to: new DataTypes(true, ['applications/create'], ['applications/fetch']).uuid,
                forwarded_to: new DataTypes(true, [], []).array,
                forward_to: new DataTypes(false, ['applications/forward'], []).uuid,
                status: new DataTypes(true, [], ['applications/updateStatus']).string,
                detail_structure: new DataTypes(true, ['applications/create'], []).json,
                remarks: new DataTypes(true, ['applications/updateStatus', 'applications/forward'], []).string,
                application_creation_timestamp: new DataTypes(true).unix_timestamp_milliseconds,
            }
        }

        res.send(new Applications())
    }
)

router.get('/schema/applicationsTemplates',
    (req, res) => {

        class ApplicationsTemplates {
            name = 'Applications Templates';
            description = 'Endpoints for creating/fetching applications templates'
            data_types = {
                template_id: new DataTypes(true, ['applicationsTemplates/update', 'applicationsTemplates/delete'], ['applicationsTemplates/fetch']).uuid,
                application_title: new DataTypes(true, ['applicationsTemplates/create'], ['applicationsTemplates/update']).string,
                detail_structure: new DataTypes(true, ['applicationsTemplates/create'], ['applicationsTemplates/update']).array,
                degree_type: new DataTypes(true, [], ['applicationsTemplates/create', 'applicationsTemplates/update']).string,
                submit_to: new DataTypes(true, [], ['applicationsTemplates/create', 'applicationsTemplates/update']).uuid,
                visibility: new DataTypes(true, ['applicationsTemplates/create'], ['applicationsTemplates/update']).array,
                restrict_visibility: new DataTypes(true, [], ['applicationsTemplates/fetch']).boolean,
            }
        }

        res.send(new ApplicationsTemplates())
    }
)

module.exports = router