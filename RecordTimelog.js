const { userId, activityUnitId, activityTypeName, workTimeSpec } = require("./myconfig");

// --- parser: only support "HH:MM-HH:MM" ---
function parseInterval(intervalStr) {
    const match = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(intervalStr.trim());
    if (!match) {
        throw new Error(`Invalid interval format: ${intervalStr}. Expected HH:MM-HH:MM`);
    }
    const [, sh, sm, eh, em] = match.map(Number);
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

// --- helpers ---
const formatDate = date =>
    `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;

const parseDateFromString = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
};

class TimelogAPI {
    constructor(userId, activityUnitId, activityTypeName) {
        this.userId = userId;
        this.activityUnitId = activityUnitId;
        this.activityTypeName = activityTypeName;
    }

    async sendRecord(startTime, endTime) {
        try {
            const response = await fetch("http://140.124.181.95:30200/api/log/record", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userID: this.userId,
                    title: "Mob",
                    activityTypeName: this.activityTypeName,
                    startTime,
                    endTime,
                    description: "",
                    activityUnitID: this.activityUnitId
                })
            });

            const data = await response.json();
            console.log(`Record sent: ${startTime} - ${endTime}, status=${response.status}`, data);
        } catch (err) {
            console.error("Error sending record:", err);
        }
    }

    async fetchStats(startDate, endDate) {
        try {
            const res = await fetch("http://140.124.181.95:30200/api/dash-board/spent-time", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userID: this.userId,
                    startDate,
                    endDate
                })
            });

            const stats = await res.json();
            console.log("\n================ Dashboard Stats ================");
            console.log("Range:", startDate, "→", endDate);
            console.log("Total Time:", stats.totalTime);

            console.table(
                Object.entries(stats.dataMap).map(([name, obj]) => ({
                    Activity: name,
                    Hours: obj.hour,
                    Minutes: obj.minute,
                    TimeLength: obj.timeLength
                }))
            );
        } catch (err) {
            console.error("Error fetching dashboard stats:", err);
        }
    }

    async fetchHistory(startDate, endDate) {
        try {
            const response = await fetch("http://140.124.181.95:30200/api/log/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userID: this.userId,
                    startDate,
                    endDate
                })
            });

            if (!response.ok) {
                console.error(`Failed to fetch history: ${response.statusText}`);
                process.exit(1);
            }

            const data = await response.json();
            const sortedLogs = data.logItemList.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            console.log("\n================ Log History ================");
            console.log("Range:", startDate, "→", endDate);
            console.table(
                sortedLogs.map(log => ({
                    ID: log.id,
                    Activity: log.activityTypeName,
                    Team: log.teamName,
                    Title: log.title,
                    Start: log.startTime,
                    End: log.endTime
                }))
            );
        } catch (err) {
            console.error("Error fetching log history:", err);
        }
    }

    async removeLog(logID) {
        const payload = {
            userID: this.userId,
            logID: logID
        };

        const response = await fetch("http://140.124.181.95:30200/api/log/remove", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Failed to remove log: ${response.statusText}`);
            process.exit(1);
        }

        console.log(`Log ${logID} removed successfully.`);
    }
}

class TimelogManager {
    constructor(api, workTime) {
        this.api = api;
        this.workTime = workTime;
    }

    async record(dateOrStartDate, endDate) {
        const createActivityTime = (baseDate, time) => {
            const date = new Date(baseDate);
            date.setHours(time.hour, time.min);
            return formatDate(date);
        };

        const processDate = async (date) => {
            for (const work of this.workTime[date.getDay()]) {
                const startTime = createActivityTime(date, work.start);
                const endTime = createActivityTime(date, work.end);
                await this.api.sendRecord(startTime, endTime);
            }
        };

        let startDate = dateOrStartDate instanceof Date
            ? dateOrStartDate
            : parseDateFromString(dateOrStartDate);

        if (!endDate) {
            await processDate(startDate);
        } else {
            let currentDate = new Date(startDate);
            const finalDate = new Date(endDate);

            while (currentDate <= finalDate) {
                await processDate(currentDate);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // After records are sent, fetch stats
        const startStr = formatDate(startDate).split(" ")[0];
        const endStr = endDate ? formatDate(endDate).split(" ")[0] : startStr;
        await this.api.fetchStats(startStr, endStr);
    }

    async recordSingleDateWithTime(date, timeRange) {
        const interval = parseInterval(timeRange);
        const createActivityTime = (baseDate, time) => {
            const dateObj = new Date(baseDate);
            dateObj.setHours(time.hour, time.min);
            return formatDate(dateObj);
        };

        const startTime = createActivityTime(date, interval.start);
        const endTime = createActivityTime(date, interval.end);
        await this.api.sendRecord(startTime, endTime);

        // Fetch stats for the single date
        const dateStr = formatDate(date).split(" ")[0];
        await this.api.fetchStats(dateStr, dateStr);
    }
}

// --- CLI ---
(async () => {
    const api = new TimelogAPI(userId, activityUnitId, activityTypeName);
    const manager = new TimelogManager(api, workTime);

    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log("Usage:");
        console.log("  node RecordTimelog.js <date>");
        console.log("  node RecordTimelog.js <startDate> <endDate>");
        console.log("  node RecordTimelog.js -t <startDate> <endDate>");
        console.log("  node RecordTimelog.js 2025-09-11 09:00-12:00");
        console.log("  node RecordTimelog.js -r <logID>");
        console.log("  node RecordTimelog.js -h <startDate> <endDate>");
        process.exit(1);
    }

    if (args[0] === "-r") {
        if (args.length < 2) {
            console.error("Please provide a logID to remove.");
            process.exit(1);
        }

        const logID = args[1];
        await api.removeLog(logID);
        process.exit(0);
    }

    if (args[0] === "-t") {
        const start = args[1] ? args[1].replace(/-/g, "/") : formatDate(new Date()).split(" ")[0];
        const end = args[2] ? args[2].replace(/-/g, "/") : start;
        await api.fetchStats(start, end);
        process.exit(0);
    }

    if (args[0] === "-h") {
        if (args.length < 3) {
            console.error("Please provide a startDate and endDate for history.");
            process.exit(1);
        }

        const startDate = args[1].replace(/-/g, "/");
        const endDate = args[2].replace(/-/g, "/");
        await api.fetchHistory(startDate, endDate);
        process.exit(0);
    }

    if (args.length === 1) {
        const date = parseDateFromString(args[0]);
        await manager.record(date);
    } else if (args.length === 2) {
        if (args[1].includes(":")) {
            // Single date with time range
            const date = parseDateFromString(args[0]);
            const timeRange = args[1];
            await manager.recordSingleDateWithTime(date, timeRange);
        } else {
            // Date range
            const startDate = parseDateFromString(args[0]);
            const endDate = parseDateFromString(args[1]);
            await manager.record(startDate, endDate);
        }
    } else {
        console.log("Invalid arguments. Please provide one or two dates (YYYY-MM-DD) or a date with a time range.");
        process.exit(1);
    }
})();
