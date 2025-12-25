# RecordTimelog
## Requirements
- Node.js **v18+** (for built-in `fetch`)
- npm (comes with Node.js)

## Setup
Edit `config.js`
```js
module.exports = {
    userId: "your-user-id",
    activityUnitId: "your-activity-unit-id",
    activityTypeName: "LabProject",
    workTimeSpec: {
        0: [],                                   // Sunday
        1: [],                                   // Monday
        2: [],                                   // Tuesday
        3: [],                                   // Wednesday
        4: ["10:00-12:00", "13:00-16:00"],       // Thursday
        5: [],                                   // Friday
        6: []                                    // Saturday
    }
};

```

## Usage

### Interactive Mode (Recommended)
Simply run the script without arguments to enter the interactive menu:
```bash
node RecordTimelog.js
```
Menu options:
1. **Record Single Date**: Log activities for a specific date (default: today). You can also specify a custom time range (e.g., `1000-1200` or `10:00-12:00`).
2. **Record Date Range**: Log activities for a range of dates.
3. **Query Stats**: View total time spent per activity type for a given date range.
4. **Query History**: View detailed log entries (includes Log IDs) for a given date range.
5. **Delete Record**: Delete a specific log entry by providing its Log ID (found via Query History).
6. **Exit**: Close the tool.

### CLI Commands

#### Record for a Single Date
```bash
node RecordTimelog.js <YYYY-MM-DD> [TimeRange]
```
Example:
```bash
node RecordTimelog.js 2025-09-11
# With custom time range:
node RecordTimelog.js 2025-09-11 1300-1800
```

#### Record for a Date Range
```bash
node RecordTimelog.js <StartDate> <EndDate>
```
Example:
```bash
node RecordTimelog.js 2025-09-11 2025-09-15
```

#### Query Statistics (Total Time)
```bash
node RecordTimelog.js -t <StartDate> <EndDate>
```
Example:
```bash
node RecordTimelog.js -t 2025-09-21 2025-09-27
```

#### Query Log History (Detailed Logs)
Useful for finding Log IDs to delete.
```bash
node RecordTimelog.js -h <StartDate> <EndDate>
```
Example:
```bash
node RecordTimelog.js -h 2025-12-01 2025-12-25
```

#### Delete a Record
```bash
node RecordTimelog.js -r <LogID>
```
Example:
```bash
node RecordTimelog.js -r 12345
```
