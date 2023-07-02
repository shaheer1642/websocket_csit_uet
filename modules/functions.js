function dynamicSort(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        /* next line works with strings and numbers, 
         * and you may want to customize it to your needs
         */
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

function dynamicSortDesc(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        /* next line works with strings and numbers, 
         * and you may want to customize it to your needs
         */
        var result = (a[property] > b[property]) ? -1 : (a[property] < b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

function msToTime(s) {

    // Pad to 2 or 3 digits, default is 2
    function pad(n, z) {
      z = z || 2;
      return ('00' + n).slice(-z);
    }
  
    var ms = s % 1000;
    s = (s - ms) / 1000;
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;
  
    if (hrs != 0)
        return pad(hrs,hrs>99? 3:2) + ' hours ' + pad(mins) + ' minutes ' + pad(secs) + ' seconds';
    if (mins != 0)
        return pad(mins) + ' minutes ' + pad(secs) + ' seconds';
    return pad(secs) + ' seconds';
}

function msToFullTime(ms) {
    var seconds = ms > 0 ? Math.floor(ms / 1000) : Math.ceil(ms / 1000),
    minutes = seconds > 0 ? Math.floor(seconds / 60) : Math.ceil(seconds / 60),
    hours   = minutes > 0 ? Math.floor(minutes / 60) : Math.ceil(minutes / 60),
    days    = hours > 0 ? Math.floor(hours / 24) : Math.ceil(hours / 24),
    months  = days > 0 ? Math.floor(days / 30) : Math.ceil(days / 30),
    years   = days > 0 ? Math.floor(days / 365) : Math.ceil(days / 365);
    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    days %= 30;
    months %= 12;
    var str = ''
    if (years != 0)
        if (years > 1)
            str += years + ' years'
        else
            str += years + ' year'
    if (months != 0)
        if (months > 1)
            str += ' ' + months + ' months'
        else
            str += ' ' + months + ' month'
    if (days != 0)
        if (days > 1)
            str += ' ' + days + ' days'
        else
            str += ' ' + days + ' day'

    if (str == '')
        str = `${hours} hours ${minutes} minutes ${seconds} seconds`

    return str.trim();
}

function getRandomColor() {
    var letters = '0123456789abcdef';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function embedScore(text) {
    return text.replaceAll('_','\\_')
}

function convertUpper(str) {
    if (typeof str != 'string') return str
    if (str.toLowerCase() == 'ms') return 'MS'
    if (str.toLowerCase() == 'phd') return 'PhD'
    return str.replace(/_/g, " ").replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
}

function checkKeysExists(obj, ref_obj, ignore_keys) {
    if (!obj) return false
    if (Object.keys(ref_obj).some(key => !Object.keys(obj).includes(key) && !ignore_keys.includes(key))) return false
    var valid = true
    Object.keys(ref_obj).map(key => {
        if (!valid) return
        if (typeof ref_obj[key] == 'object') {
            valid = checkKeysExists(obj[key], ref_obj[key], ignore_keys)
        }
    })
    return valid
}

function generateRandom1000To9999() {
    return Math.floor(Math.random() * 9999) + 1000;
}

const courseIds = {
    'cs': 'CS&IT',
    'bsi': 'BSI',
    'ae': 'AE',
    'che': 'CHE',
    'ce': 'CE',
    'eec': 'EEC',
    'ie': 'IE',
    'me': 'ME',
    'mte': 'MTE',
    'mine': 'MINE',
    'cse': 'CSE',
    'arc': 'ARC',
}
function getDepartmentIdFromCourseId(course_id) {
    return courseIds[course_id.toLowerCase().split('-')[0]] || course_id.toUpperCase().split('-')[0]
}

function escapeDBCharacters(str) {
    return str.replace(/'/g,`''`).replace(/\\/g,`\\\\`).replace(/\"/g,`\\"`).replace(/\r\n/g,`\\n`).replace(/\n/g,`\\r\\n`)
}

function isEmailValid(value) {
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(value)) return false
    else return true
}

function convertTimestampToSeasonYear(ts) {
    ts = Number(ts)
    return `${new Date(ts).getMonth() < 7 ? 'Spring' : 'Fall'} ${new Date(ts).getFullYear()}`
}

module.exports = {
    dynamicSort,
    dynamicSortDesc,
    msToTime,
    msToFullTime,
    getRandomColor,
    embedScore,
    convertUpper,
    checkKeysExists,
    escapeDBCharacters,
    getDepartmentIdFromCourseId,
    isEmailValid,
    convertTimestampToSeasonYear,
    generateRandom1000To9999
};