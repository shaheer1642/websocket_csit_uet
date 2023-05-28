const { db } = require("./db_connection");

const grades_obj = {}

db.on('connected',() => {
    db.query(`select * from grades ORDER BY serial ASC`).then(res => {
        res.rows.forEach(row => {
            grades_obj[row.grade] = {
                ...row,
                grade_points: row.grade_points.toFixed(2)
            }
        })
    }).catch(console.error)
})

function calculateQualityPoints(grade, credit_hours) {
    return (grades_obj[grade].grade_points * credit_hours) || 0
}

function getGradePoints() {
    return Object.values(grades_obj)
}

function markingEvalutation(grade_distribution, markings) {
    // absolute evaluation
    
    markings.forEach((marking,index) => {
        const absolute_evaluation = {}
        absolute_evaluation.final_term = {
            total: grade_distribution.final_term.weightage,
            obtained: Math.round(marking.final_term / grade_distribution.final_term.total_marks * grade_distribution.final_term.weightage)
        }
        absolute_evaluation.mid_term = {
            total: grade_distribution.mid_term.weightage,
            obtained: Math.round(marking.mid_term / grade_distribution.mid_term.total_marks * grade_distribution.mid_term.weightage)
        }
        absolute_evaluation.sessional = {
            total: grade_distribution.sessional.weightage,
            obtained: Math.round((Object.keys(grade_distribution.sessional.division).filter(key => grade_distribution.sessional.division[key].include)
                .reduce((sum,key) => key.match('assignments') ? 
                    sum += Object.keys(marking).reduce((sum,key2) => key2.match('assignment') ? sum += marking[key2] : sum += 0, 0)
                    : key.match('quizzes') ? 
                    sum += Object.keys(marking).reduce((sum,key2) => key2.match('quiz') ? sum += marking[key2] : sum += 0, 0)
                    : sum += marking[key] || 0
                , 0)) / (Object.keys(grade_distribution.sessional.division).filter(key => grade_distribution.sessional.division[key].include)
                .reduce((sum,key) => key.match('assignments') ? 
                    sum += grade_distribution.sessional.division.assignments.no_of_assignments * grade_distribution.sessional.division.assignments.total_marks_per_assignment
                    : key.match('quizzes') ? 
                    sum += grade_distribution.sessional.division.quizzes.no_of_quizzes * grade_distribution.sessional.division.quizzes.total_marks_per_quiz
                    : sum += grade_distribution.sessional.division[key].total_marks
                , 0)) * grade_distribution.sessional.weightage)
        }
        const absolute_total_marks = Object.keys(absolute_evaluation).reduce((sum,key) => sum += absolute_evaluation[key].total, 0)
        const absolute_obtained_marks = Object.keys(absolute_evaluation).reduce((sum,key) => sum += absolute_evaluation[key].obtained, 0)
        const absolute_percentage = Number(((absolute_obtained_marks / absolute_total_marks) * 100).toFixed(1))
        const result = {
            absolute: {
                evaluation: absolute_evaluation,
                total_marks: absolute_total_marks,
                obtained_marks: absolute_obtained_marks,
                percentage: absolute_percentage,
                grade: calculateGrade(absolute_percentage)
            }
        }
        markings[index].result = result
    })

    // relative evaluation - first calculation normalization factor

    console.log('before_sort',JSON.stringify(markings))
    markings = markings.sort((a, b) => a.result.absolute.percentage > b.result.absolute.percentage ? -1 : 1)
    console.log('after_sort',JSON.stringify(markings))
    const top_students_length = Math.ceil(markings.length * grade_distribution.marking.average_top / 100)
    const highest_obtained_marks = (markings .filter((o,index) => index < top_students_length) .reduce((sum,marking) => sum += marking.result.absolute.obtained_marks, 0)) / top_students_length
    const normalization_factor = markings[0].result.absolute.total_marks / highest_obtained_marks
    console.log('top_students_length',top_students_length)
    console.log('highest_obtained_marks',highest_obtained_marks)
    console.log('normalization_factor',normalization_factor)
    markings.forEach((marking,index) => {
        const relative_total_marks = marking.result.absolute.total_marks
        const relative_obtained_marks = Math.round(Math.min(marking.result.absolute.total_marks, marking.result.absolute.obtained_marks * normalization_factor))
        const relative_percentage = Number(((relative_obtained_marks / relative_total_marks) * 100).toFixed(1))
        const result = {
            relative: {
                evaluation: marking.result.absolute.evaluation,
                total_marks: relative_total_marks,
                obtained_marks: relative_obtained_marks,
                percentage: relative_percentage,
                grade: calculateGrade(relative_percentage)
            }
        }
        markings[index].result.relative = result.relative
    })
    return markings
}

function calculateGrade(percentage) {
    if (percentage >= 95)
        return 'A'
    else if (percentage >= 90)
        return 'A-'
    else if (percentage >= 85)
        return 'B+'
    else if (percentage >= 80)
        return 'B'
    else if (percentage >= 75)
        return 'B-'
    else if (percentage >= 70)
        return 'C+'
    else if (percentage >= 65)
        return 'C'
    else if (percentage >= 60)
        return 'C-'
    else if (percentage >= 55)
        return 'D+'
    else if (percentage >= 50)
        return 'D'
    else return 'F'
}

function calculateAttendancePercentage(attendance) {
    return Number((((Object.keys(attendance).filter(key => key.startsWith('week'))
            .reduce((arr,k) => [...arr, ...attendance[k].classes],[])
            .reduce((sum, weekClass) => weekClass.cancelled ? sum += 0 : (weekClass.attendance == 'P' || weekClass.attendance == 'L') ? sum += 1 : sum += 0, 0)) /
            (Object.keys(attendance).filter(key => key.match('week'))
                .reduce((arr,k) => [...arr, ...attendance[k].classes],[])
                .reduce((sum, weekClass) => (weekClass.attendance == '' || weekClass.cancelled) ? sum += 0 : sum += 1, 0))) * 100).toFixed(1)) || 0;
}

module.exports = {
    calculateQualityPoints,
    getGradePoints,
    markingEvalutation,
    calculateAttendancePercentage,
    calculateGrade
}