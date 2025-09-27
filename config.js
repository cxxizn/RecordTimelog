// Note: If you want to use .env file, install dotenv: npm install dotenv
// and uncomment the line below:
// require('dotenv').config();

// Helper function to parse time string "HH:MM" to {hour, min}
function parseTime(timeStr) {
    const [hour, min] = timeStr.split(':').map(Number);
    return { hour, min };
}

// Helper function to parse time range "HH:MM-HH:MM" to {start, end}
function parseTimeRange(rangeStr) {
    const [startStr, endStr] = rangeStr.split('-');
    return {
        start: parseTime(startStr),
        end: parseTime(endStr)
    };
}

// Build workTime from environment variables
function buildWorkTime() {
    const workTime = {};
    
    for (let day = 0; day <= 6; day++) {
        const envVar = process.env[`WORKTIME_${day}`];
        
        if (!envVar || envVar.trim() === '') {
            workTime[day] = [];
        } else {
            // Parse comma-separated time ranges: "09:00-12:00,13:00-18:00"
            const ranges = envVar.split(',').map(range => range.trim());
            workTime[day] = ranges.map(parseTimeRange);
        }
    }
    
    return workTime;
}

module.exports = {
    userId: process.env.USER_ID,
    activityUnitId: process.env.ACTIVITY_UNIT_ID,
    activityTypeName: process.env.ACTIVITY_TYPE_NAME || 'LabProject',
    workTime: buildWorkTime()
};