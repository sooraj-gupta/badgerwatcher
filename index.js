// main.js
const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const configManager = require('./configManager');

let watchedCourses = {};
let settingsWindow;
let courseIntervals = {};

// Add this variable at the top of your file with other state variables
let apiStatus = {
  isLive: false,
  lastUpdate: Date.now()
};

// Add a simple function to update the API status
function updateApiLiveStatus(isLive) {
  apiStatus.isLive = isLive;
  apiStatus.lastUpdate = Date.now();
  
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) return;
  
  mainWindow.webContents.send('api-live-status', apiStatus);
}


// Term options
const termOptions = [
  { code: '1262', name: 'Fall 2025' },
  { code: '1254', name: 'Spring 2025' },
  { code: '1256', name: 'Summer 2025' }
];

// Initialize the app and load any saved watched courses
app.whenReady().then(() => {
  createWindow();
  
  // Load any previously watched courses from config
  loadSavedCourses();
});

/// Load saved courses
async function loadSavedCourses() {
  try {
    const savedCourses = configManager.getWatchedCourses();
    console.log("Retrieved saved courses from config:", Object.keys(savedCourses).length);
    watchedCourses = savedCourses || {};
    
    // Only proceed if we have watched courses and a main window
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      console.error("No main window available to load courses into");
      return;
    }
    
    // Give the renderer a moment to set up event listeners
    setTimeout(() => {
      if (Object.keys(watchedCourses).length === 0) {
        console.log('No saved courses found');
        return;
      }
      
      console.log(`Loading ${Object.keys(watchedCourses).length} saved courses`);
      
      // Send the loaded courses to the renderer
      for (const courseId in watchedCourses) {
        const course = watchedCourses[courseId];
        
        // Ensure the course has all required data
        if (!course.courseDesignation || !course.title) {
          console.error(`Incomplete course data for courseId: ${courseId}`, course);
          continue;
        }
        
        console.log(`Sending course to renderer: ${courseId} - ${course.courseDesignation}`);
        
        // Send course to the renderer to display
        mainWindow.webContents.send('add-watched-course', {
          courseId,
          courseName: course.courseDesignation,
          courseTitle: course.title
        });
        
        // Start watching the course
        watchCourse(courseId, course.data, course.title);
      }
    }, 1000); // Wait 1 second for renderer to be ready
  } catch (error) {
    console.error('Error loading saved courses:', error);
  }
}

// IPC handlers for term management
ipcMain.handle('get-term', () => {
  return configManager.getTerm();
});

ipcMain.handle('set-term', (event, term) => {
  return configManager.setTerm(term);
});

ipcMain.handle('get-term-options', () => {
  return termOptions;
});

// Get app settings
ipcMain.handle('get-settings', () => {
  return configManager.getConfig();
});

// Save app settings
ipcMain.handle('save-settings', (event, settings) => {
  return configManager.updateConfig(settings);
});

// New IPC handler to remove a course from the watch list
ipcMain.handle('remove-course', (event, courseId) => {
  // Clear the interval for this course if it exists
  if (courseIntervals[courseId]) {
    clearInterval(courseIntervals[courseId]);
    delete courseIntervals[courseId];
  }
  
  // Remove from our memory object
  if (watchedCourses[courseId]) {
    delete watchedCourses[courseId];
  }
  
  // Remove from persisted config
  configManager.removeWatchedCourse(courseId);
  
  return { success: true, courseId };
});

ipcMain.handle('open-settings', () => {
  openSettingsWindow();
  return true; // invoke() expects a return value
});

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true, // Enables transparent background
    vibrancy: 'fullscreen-ui',
    frame: false, // For frameless design

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function sendiMessageNotification(message) {
  const scriptPath = path.join(__dirname, 'sendMessage.scpt');
  const phoneNumbers = configManager.getPhoneNumbers();
  
  if (phoneNumbers.length === 0) {
    console.log("No phone numbers configured, skipping iMessage notification");
    return;
  }
  
  for (const phoneNumber of phoneNumbers) {
    execFile('osascript', [scriptPath, message, phoneNumber], (error, stdout, stderr) => {
      if (error) {
        console.error('Error sending iMessage:', error);
        return;
      }
      console.log('iMessage sent:', stdout);
    });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    frame: false, // For frameless design
    transparent: true, // Enables transparent background
    vibrancy: 'fullscreen-ui', // macOS only
    titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
    icon: path.join(__dirname, 'badgerwatcher.icns'),
  });

  console.log(path.join(__dirname, 'badgerwatcher.icns'));
  win.loadFile('index.html');

  // For development - uncomment to open DevTools
  // win.webContents.openDevTools();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper function to fetch course data based on search query
async function fetchCourseData(courseName) {
  const fetch = (await import('node-fetch')).default;
  const url = "https://public.enroll.wisc.edu/api/search/v1";

  const term = await configManager.getTerm();
  const payload = {
    selectedTerm: term.code,
    queryString: courseName,
    filters: [
      {
        has_child: {
          type: "enrollmentPackage",
          query: {
            bool: {
              must: [
                { match: { "packageEnrollmentStatus.status": "OPEN WAITLISTED CLOSED" } },
                { match: { published: true } }
              ]
            }
          }
        }
      }
    ],
    page: 1,
    pageSize: 10,
    sortOrder: "SCORE"
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    return data.hits || [];
  } catch (error) {
    console.error("Error fetching course data:", error);
    return [];
  }
}



// Function to fetch detailed course data by courseId
async function fetchCourseDetails(termCode, subjectCode, courseId) {
  const fetch = (await import('node-fetch')).default;
  const url = `https://public.enroll.wisc.edu/api/search/v1/enrollmentPackages/${termCode}/${subjectCode}/${courseId}`;
  // console.log(url);
  const term = configManager.getTerm();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Priority': 'u=3, i',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
      },
      cache: 'default',
      credentials: 'include',
      mode: 'cors',
      redirect: 'follow',
      referrer: `https://public.enroll.wisc.edu/search?term=${term.code}&keywords=COMP%20SCI%20640&closed=true`,
      referrerPolicy: 'strict-origin-when-cross-origin'
    });

    if (!response.ok) 
    {
      updateApiLiveStatus(false); // API is not responding correctly
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  
    const data = await response.json();
    updateApiLiveStatus(true); // API is working
    return data; // return the detailed course data
  } catch (error) {
    updateApiLiveStatus(false); // API is not responding
    console.error("Error fetching course details:", error);
    return null;
  }
}

// IPC handler to search for courses based on user input
ipcMain.handle('search-courses', async (event, courseName) => {
  return await fetchCourseData(courseName);
});

// IPC handler to add the selected course to watch list
ipcMain.handle('add-course', async (event, course) => {
  const courseId = course.courseId;
  const termCode = course.termCode;
  if (!course.subject) return { error: "Invalid course data - missing subject" };
  const subjectCode = course.subject.subjectCode;

  // Check if course is already being watched
  if (watchedCourses[courseId]) {
    return { 
      courseId, 
      courseName: watchedCourses[courseId].courseDesignation, 
      courseTitle: watchedCourses[courseId].title,
      alreadyWatched: true
    };
  }

  // Fetch detailed course data for sections
  const detailedCourseData = await fetchCourseDetails(termCode, subjectCode, courseId);
  if (!detailedCourseData) return { error: "Failed to retrieve course details." };

  const courseData = {
    data: detailedCourseData, 
    title: course.title, 
    courseDesignation: course.courseDesignation, 
    termCode: termCode,
    subjectCode: subjectCode
  };

  watchedCourses[courseId] = courseData;
  
  // Save to persistent storage
  configManager.saveWatchedCourse(courseId, courseData);

  // Start watching the course
  watchCourse(courseId, detailedCourseData, course.title);

  return { courseId, courseName: course.courseDesignation, courseTitle: course.title };
});


// IPC handler to send a test message
ipcMain.handle('send-test-message', async (event, phoneNumber) => {
  try {
    const scriptPath = path.join(__dirname, 'sendMessage.scpt');
    const testMessage = "🧪 This is a test message from BadgerWatcher! If you're seeing this, your notification setup is working correctly.";
    
    return new Promise((resolve, reject) => {
      execFile('osascript', [scriptPath, testMessage, phoneNumber], (error, stdout, stderr) => {
        if (error) {
          console.error('Error sending test iMessage:', error);
          resolve({ success: false, error: error.message });
          return;
        }
        console.log('Test iMessage sent:', stdout);
        resolve({ success: true });
      });
    });
  } catch (error) {
    console.error("Error sending test message:", error);
    return { success: false, error: error.message };
  }
});

// IPC handler to fetch course grade data
ipcMain.handle('fetch-course-grades', async (event, courseUuid) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const apiKey = configManager.getMadGradesApiKey() || 'db0b773feba0467688172d87b38f3f95';
    const url = `https://api.madgrades.com/v1/courses/${courseUuid}/grades`;
    // console.log(courseUuid)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token token=${apiKey}`
      }
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching grade data:", error);
    return null;
  }
});

// IPC handler to search for a course UUID by course code
ipcMain.handle('search-course-uuid', async (event, courseDesignation) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const apiKey = configManager.getMadGradesApiKey() || 'db0b773feba0467688172d87b38f3f95';
    
    // Parse the course designation (e.g., "COMP SCI 642")
    const parts = courseDesignation.split(/\s+/);
    let subject, number;
    
    if (parts.length >= 2) {
      // Handle cases where subject might be two words (e.g., "COMP SCI")
      if (parts.length > 2) {
        subject = parts.slice(0, -1).join(' ');
        number = parts[parts.length - 1];
      } else {
        subject = parts[0];
        number = parts[1];
      }
    } else {
      console.error("Invalid course designation format:", courseDesignation);
      return null;
    }
    
    // Encode the query properly
    const query = encodeURIComponent(`${subject} ${number}`);
    const url = `https://api.madgrades.com/v1/courses?query=${query}&limit=10`;
    
    console.log(`Searching for course with query: ${query}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token token=${apiKey}`
      }
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    
    const data = await response.json();
    
    // Log results for debugging
    console.log(`Found ${data.results?.length || 0} potential matches for ${courseDesignation}`);
    
    if (!data.results || data.results.length === 0) {
      console.error("No results found for course:", courseDesignation);
      return null;
    }
    
    // Find the exact match by checking both subject and course number
    const exactMatch = data.results.find(course => {
      const courseSubjects = course.subjects.map(s => s.abbreviation.toUpperCase());
      return courseSubjects.includes(subject.toUpperCase()) && course.number.toString() === number;
    });
    
    // If we found an exact match, return that UUID
    if (exactMatch) {
      // console.log(`Found exact match for ${courseDesignation}: ${exactMatch.name} (${exactMatch.uuid})`);
      return exactMatch.uuid;
    }
    
    // Otherwise return the first result as a fallback
    console.log(`No exact match found, using first result: ${data.results[0].name} (${data.results[0].uuid})`);
    return data.results[0].uuid;
    
  } catch (error) {
    console.error("Error searching for course UUID:", error);
    return null;
  }
});

// IPC handler to get data for a specific course
ipcMain.handle('get-course-data', (event, courseId) => {
  if (!watchedCourses[courseId]) {
    return null;
  }
  
  return {
    courseId,
    courseDesignation: watchedCourses[courseId].courseDesignation,
    title: watchedCourses[courseId].title,
    termCode: watchedCourses[courseId].termCode,
    subjectCode: watchedCourses[courseId].subjectCode,
    data: watchedCourses[courseId].data
  };
});

// IPC handler to fetch syllabus/course description data
ipcMain.handle('fetch-course-syllabus', async (event, courseData) => {
  try {
    if (!courseData) return null;
    
    // Extract course data from saved watchedCourses if we only have the ID
    if (typeof courseData === 'string' && watchedCourses[courseData]) {
      courseData = watchedCourses[courseData];
    }
    
    // Extract description from instructor-provided details if available
    const detailedData = Array.isArray(courseData.data) ? courseData.data : [];
    
    for (let section of detailedData) {
      if (section.instructorProvidedClassDetails) {
        return {
          description: section.instructorProvidedClassDetails.instructorDescription,
          format: section.instructorProvidedClassDetails.format,
          topics: section.instructorProvidedClassDetails.typicalTopicsAndOrSchedule,
          learningOutcomes: section.instructorProvidedClassDetails.learningOutcome
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching course syllabus:', error);
    return null;
  }
});

// IPC handler to fetch similar courses


// Fix the fetchSimilarCourses handler to properly extract enrollment information
// Fix the fetchSimilarCourses handler to properly extract enrollment information
ipcMain.handle('fetch-similar-courses', async (event, subjectCode, courseId) => {
  try {
    const term = configManager.getTerm();
    const fetch = (await import('node-fetch')).default;

    console.log("Fetching similar courses for courseId:", courseId);
    
    // Get current course data for comparison
    const currentCourse = watchedCourses[courseId];
    if (!currentCourse) {
      console.error("Current course not found in watched courses");
      return [];
    }

    console.log("Found current course:", currentCourse.courseDesignation);
    
    // Get the course catalog number to find similar level courses
    const catalogNumber = currentCourse.data[0]?.catalogNumber || '';
    const courseLevel = catalogNumber.charAt(0); // First digit gives course level (e.g., 500-level)
    
    // Construct API URL to search for similar courses by subject and level
    const url = "https://public.enroll.wisc.edu/api/search/v1";
    
    const payload = {
      selectedTerm: term.code,
      queryString: `${subjectCode} ${courseLevel}*`,
      filters: [
        {
          has_child: {
            type: "enrollmentPackage",
            query: {
              bool: {
                must: [
                  { match: { published: true } }
                ]
              }
            }
          }
        }
      ],
      page: 1,
      pageSize: 8, // Increase to show more options
      sortOrder: "SUBJECT_COURSE"
    };

    console.log("Searching for similar courses with payload:", JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    
    if (!data.hits || data.hits.length === 0) {
      console.log("No similar courses found");
      return [];
    }

    console.log(`Found ${data.hits.length} potential similar courses`);
    
    // Filter out the current course
    const coursesToProcess = data.hits.filter(course => course.courseId !== courseId);
    console.log(`After filtering current course: ${coursesToProcess.length} courses to process`);
    
    // Process each course to get detailed enrollment information
    const similarCourses = await Promise.all(coursesToProcess.map(async (course) => {
      console.log(`Processing similar course: ${course.subject.shortDescription} ${course.catalogNumber}`);
      
      try {
        // Use fetchCourseDetails to get accurate enrollment information
        const courseDetails = await fetchCourseDetails(
          term.code, 
          course.subject.subjectCode, 
          course.courseId
        );
        
        if (!courseDetails || courseDetails.length === 0) {
          console.log(`No details found for course ${course.courseId}`);
          return null;
        }
        
        // Get the first section details (usually the primary section)
        const firstSection = courseDetails[0];
        
        // Extract meeting information
        let meetingTimes = "N/A";
        let location = "N/A";
        let instructor = "N/A";
        let section = "N/A";
        
        // Get section number
        if (firstSection.sections && firstSection.sections.length > 0) {
          section = `${firstSection.sections[0].type} ${firstSection.sections[0].sectionNumber}`;
          
          // Get instructor information
          if (firstSection.sections[0].instructor) {
            const instr = firstSection.sections[0].instructor;
            instructor = `${instr.name?.first || ''} ${instr.name?.last || ''}`.trim();
          }
        }
        
        // Get meeting information
        if (firstSection.classMeetings && firstSection.classMeetings.length > 0) {
          const meeting = firstSection.classMeetings[0];
          
          // Format days
          const days = [];
          if (meeting.monday) days.push("M");
          if (meeting.tuesday) days.push("T");
          if (meeting.wednesday) days.push("W");
          if (meeting.thursday) days.push("R");
          if (meeting.friday) days.push("F");
          
          // Format times
          const startTime = formatTime(meeting.meetingTimeStart);
          const endTime = formatTime(meeting.meetingTimeEnd);
          meetingTimes = `${days.join("")} ${startTime}-${endTime}`;
          
          // Format location
          if (meeting.building) {
            location = `${meeting.building.buildingName || ''} ${meeting.room || ''}`.trim();
          }
        }
        
        // Get accurate enrollment data
        const enrollmentStatus = firstSection.enrollmentStatus || {};
        const packageStatus = firstSection.packageEnrollmentStatus || {};
        
        // Determine status accurately
        let status = packageStatus.status || "UNKNOWN";
        
        // Calculate seats
        const capacity = enrollmentStatus.capacity || 0;
        const enrolled = enrollmentStatus.currentlyEnrolled || 0;
        const waitlist = enrollmentStatus.waitlistCurrentSize || 0;
        const waitlistCapacity = enrollmentStatus.waitlistCapacity || 0;
        const openSeats = Math.max(0, capacity - enrolled);
        
        // Determine if course is truly open
        if (openSeats > 0) {
          status = "OPEN";
        } else if (waitlist > 0 || (waitlistCapacity > 0 && waitlistCapacity > waitlist)) {
          status = "WAITLISTED";
        } else {
          status = "CLOSED";
        }
        
        // Build the complete course object with rich details
        return {
          id: course.courseId,
          title: course.title,
          subject: course.subject.shortDescription,
          courseNumber: course.catalogNumber,
          termCode: term.code,
          status: status,
          enrollmentCapacity: capacity,
          enrolled: enrolled,
          waitlist: waitlist,
          waitlistCapacity: waitlistCapacity,
          openSeats: openSeats,
          section: section,
          meetingTimes: meetingTimes,
          location: location,
          instructor: instructor,
          // Additional useful information
          hasRestrictions: firstSection.enrollmentRequirementGroups?.catalogRequirementGroups?.length > 0,
          gradeComponent: firstSection.sections?.[0]?.gradedComponent === true,
          instructionMode: firstSection.sections?.[0]?.instructionMode || 'N/A',
          sessionCode: firstSection.sessionCode || 'N/A'
        };
      } catch (error) {
        console.error(`Error processing similar course ${course.courseId}:`, error);
        return null;
      }
    }));
    
    // Filter out null results and sort by open seats first, then by course number
    const validCourses = similarCourses.filter(course => course !== null);
    console.log(`Found ${validCourses.length} valid similar courses with detailed information`);
    
    return validCourses.sort((a, b) => {
      // First, sort by status (OPEN first)
      if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
      if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
      
      // If both are OPEN, sort by number of available seats (more seats first)
      if (a.status === 'OPEN' && b.status === 'OPEN') {
        if (a.openSeats > b.openSeats) return -1;
        if (a.openSeats < b.openSeats) return 1;
      }
      
      // If both are WAITLISTED, sort by waitlist size (smaller waitlist first)
      if (a.status === 'WAITLISTED' && b.status === 'WAITLISTED') {
        if (a.waitlist < b.waitlist) return -1;
        if (a.waitlist > b.waitlist) return 1;
      }
      
      // Finally, sort by course number
      return a.courseNumber.localeCompare(b.courseNumber);
    });
      
  } catch (error) {
    console.error('Error fetching similar courses:', error);
    return [];
  }
});


// Helper function to format time from milliseconds
function formatTime(timeMillis) {
  if (!timeMillis) return "N/A";
  
  const hours = Math.floor(timeMillis / 3600000);
  const minutes = Math.floor((timeMillis % 3600000) / 60000);
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12; // Convert 0 to 12
  const formattedMinutes = minutes.toString().padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}${ampm}`;
}

// IPC handler to fetch textbook information
// Modify the fetchTextbookInfo handler to use existing course data
ipcMain.handle('fetch-textbook-info', async (event, term, subjectCode, courseNumber, course) => {
  try {
    // Instead of making an API call, use the data we already have in course object
    if (!course || !course.data) {
      return {
        hasTextbooks: false,
        error: "No course data available"
      };
    }

    // Find sections with textbook info
    const textbooks = [];
    const otherMaterials = [];
    let sectionNotes = null;
    let bookstoreLink = `https://www.uwbookstore.com/textbook-search?course=${subjectCode}-${courseNumber}`;
    
    // Check each section in the course for textbook information
    for (const section of course.data) {
      if (section.sections && section.sections.length > 0) {
        for (const sectionDetail of section.sections) {
          if (sectionDetail.classMaterials && sectionDetail.classMaterials.length > 0) {
            for (const material of sectionDetail.classMaterials) {
              if (material.materialsDefined === true) {
                // Get section notes if available
                if (material.sectionNotes) {
                  sectionNotes = material.sectionNotes;
                }
                
                // Add textbooks
                if (material.textbooks && material.textbooks.length > 0) {
                  material.textbooks.forEach(book => {
                    // Check if this textbook is not already in our list
                    if (!textbooks.find(b => b.isbn === book.isbn)) {
                      textbooks.push({
                        ...book,
                        coverImage: book.isbn ? 
                          `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg` : 
                          null,
                        required: book.materialRequirement === "REQUIRED",
                        price: "Check bookstore",
                        usedAvailable: true,
                        rentalAvailable: true,
                        digitalAvailable: book.isbn ? true : false
                      });
                    }
                  });
                }
                
                // Add other materials
                if (material.otherMaterials && material.otherMaterials.length > 0) {
                  material.otherMaterials.forEach(item => {
                    if (!otherMaterials.find(m => m.description === item.description)) {
                      otherMaterials.push({
                        ...item,
                        required: item.materialRequirement === "REQUIRED"
                      });
                    }
                  });
                }
              }
            }
          }
        }
      }
    }
    
    return {
      hasTextbooks: textbooks.length > 0 || otherMaterials.length > 0,
      textbooks,
      otherMaterials,
      sectionNotes,
      bookstoreLink
    };
    
  } catch (error) {
    console.error('Error processing textbook information:', error);
    return {
      hasTextbooks: false,
      error: error.message
    };
  }
});

// Function to periodically check the course status
function watchCourse(courseId, course, courseTitle) {
  new Notification({ title: 'Watching', body: `${watchedCourses[courseId].title}` }).show();

  intervalFunction(courseId, course, courseTitle);

  // Store the interval ID so we can clear it if needed
  courseIntervals[courseId] = setInterval(async () => {
    await intervalFunction(courseId, course, courseTitle);
  }
  , 5000);
}

async function intervalFunction(courseId, course, courseTitle) {
  const mainWindow = BrowserWindow.getAllWindows()[0]; 
  if (!mainWindow) return; // Skip if no window is available
  
  mainWindow.webContents.send('course-load', courseId);
  // console.log(courseId);
  
  const detailedCourseData = await fetchCourseDetails(
    watchedCourses[courseId].termCode, 
    watchedCourses[courseId].subjectCode, 
    courseId
  );
  
  if (!detailedCourseData) return { error: "Failed to retrieve course details." };
  
  try {       
    let results = [];
    let availableSeats = 0;
    
    for (let i in detailedCourseData) {
      results.push(detailedCourseData[i]['packageEnrollmentStatus']);
      const currentStatus = detailedCourseData[i]['packageEnrollmentStatus'];
      const previousStatus = watchedCourses[courseId].data[i]['packageEnrollmentStatus'];
      
      // Status change notification
      if ((currentStatus['status'] != previousStatus['status'])) {
        new Notification({ 
          title: watchedCourses[courseId].courseDesignation, 
          body: `${watchedCourses[courseId].title} section is now ${currentStatus['status']}!` 
        }).show();
        
        sendiMessageNotification(
          `🚨${watchedCourses[courseId].courseDesignation} ${currentStatus['status']}!🚨 ` +
          `${watchedCourses[courseId].title} is ${currentStatus['status']}`
        );
      }
      // Someone dropped a seat
      else if (currentStatus['status'] == "OPEN" && currentStatus['availableSeats'] > previousStatus['availableSeats']) {
        new Notification({ 
          title: watchedCourses[courseId].courseDesignation, 
          body: `Someone just dropped: ${watchedCourses[courseId].title} – there are now ${currentStatus['availableSeats']} open seats!` 
        }).show();
        
        sendiMessageNotification(
          `🚨${watchedCourses[courseId].courseDesignation} Someone just dropped!🚨 ` +
          `${watchedCourses[courseId].title} there are now ${currentStatus['availableSeats']} open seats!`
        );
      }
      // Someone took a seat
      else if (currentStatus['status'] == "OPEN" && currentStatus['availableSeats'] < previousStatus['availableSeats']) {
        new Notification({ 
          title: watchedCourses[courseId].courseDesignation, 
          body: `Someone just enrolled: ${watchedCourses[courseId].title}, there are now ${currentStatus['availableSeats']} open seats!` 
        }).show();
        
        sendiMessageNotification(
          `🚨${watchedCourses[courseId].courseDesignation} Someone just enrolled!🚨 ` +
          `${watchedCourses[courseId].title} there are now ${currentStatus['availableSeats']} open seats!`
        );
      }
      
      availableSeats += currentStatus['availableSeats'];
      
      // Save the updated data
      watchedCourses[courseId].data = detailedCourseData;
      configManager.saveWatchedCourse(courseId, watchedCourses[courseId]);
    }
    
    // Send update to the UI
    mainWindow.webContents.send('course-update', { courseId, status: results, availableSeats });
  } catch (error) {
    console.error("Error in watchCourse interval:", error);
  }
}