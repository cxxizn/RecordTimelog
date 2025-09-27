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
### Single date
`node RecordTimelog.js 2025-09-11`
Logs activity for 2025/09/11 according to config.js.

### Date range
`node RecordTimelog.js 2025-09-11 2025-09-15`
Logs activities for every day in the range 2025/09/11 – 2025/09/15.