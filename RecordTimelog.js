const { userId, activityUnitId, activityTypeName, workTime } = require("./config");

function parseInterval(intervalStr) {
    const match = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(intervalStr.trim());
    if (!match) {
        throw new Error(`Invalid interval format: ${intervalStr}. Expected HH:MM-HH:MM`);
    }
    const [ , sh, sm, eh, em ] = match.map(Number);
    return {
        start: { hour: sh, min: sm },
        end: { hour: eh, min: em }
    };
}

function normalizeWorkTime(spec) {
    const result = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const [day, intervals] of Object.entries(spec || {})) {
        if (!Array.isArray(intervals)) continue;
        result[day] = intervals.map(parseInterval);
    }
    return result;
}

const workTime = normalizeWorkTime(workTimeSpec);

const formatDate = date => 
    `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;

const parseDate = (yearOrDateObj, month, dayOfMonth) =>
    yearOrDateObj instanceof Date ? yearOrDateObj : new Date(yearOrDateObj, month - 1, dayOfMonth);

function record(dateOrStartDate, endDate, month, dayOfMonth) {
    const createActivityTime = (baseDate, time) => {
        const date = new Date(baseDate);
        date.setHours(time.hour, time.min);
        return formatDate(date);
    };

    const sendRecord = (startTime, endTime) => {
        fetch("http://140.124.181.95:30200/api/log/record", {
            credentials: "include",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0",
                Accept: "application/json, text/plain, */*",
                "Accept-Language": "zh-TW,en-US;q=0.7,en;q=0.3",
                "Content-Type": "application/json",
                Authorization: "null",
                Pragma: "no-cache",
                "Cache-Control": "no-cache"
            },
            referrer: "http://140.124.181.95:30201/",
            body: JSON.stringify({
                userID: userId,
                title: "Mob",
                activityTypeName,
                startTime,
                endTime,
                description: "",
                activityUnitID: activityUnitId
            }),
            method: "POST",
            mode: "cors"
        });
    };

    const processDate = (date) => {
        workTime[date.getDay()].forEach((work) => {
            const startTime = createActivityTime(date, work.start);
            const endTime = createActivityTime(date, work.end);
            sendRecord(startTime, endTime);
        });
    };

    let startDate = dateOrStartDate instanceof Date
        ? dateOrStartDate
        : parseDate(dateOrStartDate, month, dayOfMonth);

    if (!endDate) {
        // If no end date is provided, record only for a single day
        processDate(startDate);
    } else {
        // Iterate through the date range
        let currentDate = new Date(startDate);
        const finalDate = new Date(endDate);

        while (currentDate <= finalDate) {
            processDate(currentDate);
            currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
        }
    }
}

// Command-line argument parsing
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log("Please provide arguments, for example:");
    console.log("node RecordTimelog.js 2025-09-11");
    console.log("node RecordTimelog.js 2025-09-11 2025-09-15");
    process.exit(1);
}

const parseDateFromString = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
};

if (args.length === 1) {
    // Single date
    const date = parseDateFromString(args[0]);
    record(date);
} else if (args.length === 2) {
    // Date range
    const startDate = parseDateFromString(args[0]);
    const endDate = parseDateFromString(args[1]);
    record(startDate, endDate);
} else {
    console.log("Invalid argument format. Please provide one or two dates (YYYY-MM-DD).");
    process.exit(1);
}