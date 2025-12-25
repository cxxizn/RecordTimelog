const { userId, activityUnitId, activityTypeName, workTimeSpec } = require("./myconfig");
const readline = require('readline');

// --- parser: support flexible formats "HH:MM-HH:MM", "H-H", "HMM-HMM" ---
function parseTimePart(part) {
    part = part.trim();
    if (!part) throw new Error("Empty time part");

    let h, m;
    if (part.includes(":")) {
        [h, m] = part.split(":").map(Number);
    } else {
        if (part.length <= 2) {
            h = Number(part);
            m = 0;
        } else {
            // 3 or 4 digits: 930 -> 09:30, 1330 -> 13:30
            h = Number(part.slice(0, part.length - 2));
            m = Number(part.slice(part.length - 2));
        }
    }

    if (isNaN(h) || isNaN(m)) throw new Error(`Invalid time number: ${part}`);
    return { hour: h, min: m };
}

function parseInterval(intervalStr) {
    const parts = intervalStr.split("-");
    if (parts.length !== 2) {
        throw new Error(`Invalid interval format: ${intervalStr}. Expected Start-End (e.g., 9-18, 09:00-18:00, 9-1330)`);
    }

    return {
        start: parseTimePart(parts[0]),
        end: parseTimePart(parts[1])
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

// --- constants ---
const API_BASE_URL = "http://140.124.181.95:30200";

// --- helpers ---
const pad = (n) => String(n).padStart(2, '0');
const formatDate = date =>
    `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

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
            const response = await fetch(`${API_BASE_URL}/api/log/record`, {
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
            const res = await fetch(`${API_BASE_URL}/api/dash-board/spent-time`, {
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
            const response = await fetch(`${API_BASE_URL}/api/log/history`, {
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

        const response = await fetch(`${API_BASE_URL}/api/log/remove`, {
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

// --- Interactive Helpers ---
function promptUser(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function interactiveMode(api, manager) {
    console.log("\n--- RecordTimelog Interactive Mode ---");
    console.log("1. Record Single Date (with optional time range)");
    console.log("2. Record Date Range");
    console.log("3. Query Stats (Date Range)");
    console.log("4. Query History (Date Range)");
    console.log("5. Delete Record (by ID)");
    console.log("6. Exit");

    const choice = await promptUser("Select an option (1-6): ");

    try {
        if (choice === "1") {
            const dateStr = await promptUser("Enter Date (YYYY-MM-DD) [default: Today]: ");
            const finalDateStr = dateStr || formatDate(new Date()).split(" ")[0];
            const timeRange = await promptUser("Enter Time Range (optional, e.g., 9-18, 930-1200) [default: full day from config]: ");

            if (timeRange) {
                const date = parseDateFromString(finalDateStr);
                await manager.recordSingleDateWithTime(date, timeRange);
            } else {
                const date = parseDateFromString(finalDateStr);
                await manager.record(date);
            }

        } else if (choice === "2") {
            const startStr = await promptUser("Enter Start Date (YYYY-MM-DD): ");
            const endStr = await promptUser("Enter End Date (YYYY-MM-DD): ");
            if (!startStr || !endStr) {
                console.error("Start and End dates are required.");
                return;
            }
            const startDate = parseDateFromString(startStr);
            const endDate = parseDateFromString(endStr);
            await manager.record(startDate, endDate);

        } else if (choice === "3") {
            const startStr = await promptUser("Enter Start Date (YYYY-MM-DD) [default: Today]: ");
            const actualStart = startStr || formatDate(new Date()).split(" ")[0];
            const endStr = await promptUser(`Enter End Date (YYYY-MM-DD) [default: ${actualStart}]: `);
            const actualEnd = endStr || actualStart;

            await api.fetchStats(actualStart.replace(/-/g, "/"), actualEnd.replace(/-/g, "/"));

        } else if (choice === "4") {
            const startStr = await promptUser("Enter Start Date (YYYY-MM-DD) [default: Today]: ");
            const actualStart = startStr || formatDate(new Date()).split(" ")[0];
            const endStr = await promptUser(`Enter End Date (YYYY-MM-DD) [default: ${actualStart}]: `);
            const actualEnd = endStr || actualStart;

            await api.fetchHistory(actualStart.replace(/-/g, "/"), actualEnd.replace(/-/g, "/"));

        } else if (choice === "5") {
            const logID = await promptUser("Enter Log ID to remove: ");
            if (logID) {
                await api.removeLog(logID);
            } else {
                console.log("No Log ID provided.");
            }

        } else if (choice === "6") {
            process.exit(0);
        } else {
            console.log("Invalid option.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

// --- CLI ---
(async () => {
    const api = new TimelogAPI(userId, activityUnitId, activityTypeName);
    const manager = new TimelogManager(api, workTime);

    const args = process.argv.slice(2);

    if (args.length === 0) {
        await interactiveMode(api, manager);
        return;
    }

    if (args[0] === "-r") {
        if (args.length < 2) {
            console.error("Please provide a logID to remove.");
            process.exit(1);
        }
        await api.removeLog(args[1]);
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
        await api.fetchHistory(args[1].replace(/-/g, "/"), args[2].replace(/-/g, "/"));
        process.exit(0);
    }

    const isDateFormat = (str) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(str);

    if (args.length === 1) {
        const date = parseDateFromString(args[0]);
        await manager.record(date);
    } else if (args.length === 2) {
        if (isDateFormat(args[1])) {
            const startDate = parseDateFromString(args[0]);
            const endDate = parseDateFromString(args[1]);
            await manager.record(startDate, endDate);
        } else {
            const date = parseDateFromString(args[0]);
            await manager.recordSingleDateWithTime(date, args[1]);
        }
    } else {
        console.log("Usage:");
        console.log("  node RecordTimelog.js                 (Interactive Mode)");
        console.log("  node RecordTimelog.js <date>");
        console.log("  node RecordTimelog.js <startDate> <endDate>");
        console.log("  node RecordTimelog.js <date> <timeRange>");
        console.log("  node RecordTimelog.js -t <startDate> <endDate>");
        console.log("  node RecordTimelog.js -r <logID>");
        console.log("  node RecordTimelog.js -h <startDate> <endDate>");
        process.exit(1);
    }
})();
