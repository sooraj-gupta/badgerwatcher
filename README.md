# BadgerWatcher

<p align="center">
  <img src="badgerwatcher.png" width="120" height="120" alt="BadgerWatcher Logo">
</p>

An app to watch status for UW-Madison courses. Runs locally with an Electron app making requests to the wisc.edu enrollment API. Desktop notifications are enabled however some setup is required for SMS/iMessage notifications.

## Features

- 🔍 Search for UW-Madison courses 
- 👀 Track multiple courses simultaneously
- 🔔 Real-time notifications when course status changes 
- 📱 SMS/iMessage notifications (when running on macOS only)
- 📊 Historical grade distributions for courses
- 🎓 Professor history and term-by-term grade analysis
- 🎚️ Change terms (Fall, Spring, Summer)
- 💾 Persistent settings and course tracking
- Runs Locally

## Screenshots

### Main Interface
![BadgerWatcher Screenshot](screenshot.png)

### Grade Distribution Feature
![Grade Distribution](grade_distribution.png)
*View detailed historical grade data for any course*

### Term-by-Term Breakdown
![Term Breakdown](term_breakdown_screenshot.png)
*See how grades vary by instructor and semester*

## Installation

```bash
# Clone the repository
git clone https://github.com/sooraj-gupta/badgerwatcher.git

# Navigate to the directory
cd badgerwatcher

# Install dependencies
npm install

# Start the application
npm start
```

## How to Use

1. **Launch the app**: Run the app using `npm start`
2. **Select a term**: Choose the academic term you want to track (Fall, Spring, Summer)
3. **Search for courses**: Type course names or numbers in the search bar
4. **Track courses**: Click the eye icon to start watching a course
5. **Monitor status**: The app will show current status (Open, Waitlisted, Closed) with seat counts
6. **View grade history**: Click the chart icon next to any course to view historical grade distributions
7. **Get notifications**: You'll receive desktop notifications when course status changes

## Grade Distribution Feature

View historical course grades to help you make informed decisions:

- **Grade Charts**: Visualize the distribution of grades (A-F) for any course
- **GPA Metrics**: See the average GPA for the course over its entire history
- **Instructor Analysis**: Compare how different instructors grade the same course
- **Term Comparisons**: View semester-by-semester breakdowns to identify trends
- **Statistical Insights**: Analyze A-rates and other performance metrics

To access grade data:
1. Add a course to your watchlist
2. Click the chart icon (📊) next to the course
3. Switch to the "Grade Distribution" tab

![Grade Distribution Feature](grade_feature_annotated.png)

## iMessage Notifications (macOS only)

To receive iMessage notifications:
1. Go to Settings (gear icon)
2. Add your phone number
3. Save settings

## Configuration

Settings are saved to app-config.json and include:
- Selected term
- Phone numbers for notifications
- Watched courses
- MadGrades API key (optional)

## Requirements

- Node.js
- npm
- Chart.js (automatically installed with npm)
- macOS for iMessage notifications

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- University of Wisconsin-Madison for the public course API
- MadGrades API for historical course grade data

## Disclaimer

This app is not affiliated with, endorsed by, or sponsored by the University of Wisconsin-Madison. Use at your own risk.

---

By: Sooraj Gupta 2025
