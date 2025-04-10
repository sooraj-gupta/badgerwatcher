// Initialize the term selector
async function initTermSelector() {
  try {
    const termOptions = await window.electronAPI.getTermOptions();
    const currentTerm = await window.electronAPI.getTerm();
    
    const termSelect = document.getElementById('termSelect');
    termSelect.innerHTML = '';
    
    termOptions.forEach(term => {
      const option = document.createElement('option');
      option.value = term.code;
      option.textContent = term.name;
      
      if (currentTerm && term.code === currentTerm.code) {
        option.selected = true;
      }
      
      termSelect.appendChild(option);
    });
    
    // Add event listener for term changes
    termSelect.addEventListener('change', async () => {
      const selectedIndex = termSelect.selectedIndex;
      const selectedTerm = termOptions[selectedIndex];
      
      await window.electronAPI.setTerm(selectedTerm);
      // Clear search results when term changes
      document.getElementById('searchResults').innerHTML = '';
      document.getElementById('courseInput').value = '';
    });
  } catch (error) {
    console.error('Failed to initialize term selector:', error);
  }
}

async function searchCourses() {
  const courseName = document.getElementById('courseInput').value.trim();
  if (courseName.length < 1) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  document.getElementById('searchResults').innerHTML = '<span class="loading"><img src="loading.png"/></span>';
  if (!courseName) return;

  try {
    const results = await window.electronAPI.searchCourses(courseName);
    displaySearchResults(results);
  } catch (error) {
    console.error("Error searching courses:", error);
  }
}

function displaySearchResults(courses) {
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = ''; // Clear previous results

  courses.forEach(course => {
    const courseDiv = document.createElement('div');
    courseDiv.classList.add('course-result');
    courseDiv.innerHTML = `
      <span class="left">
        <span class="courseNum">${course.courseDesignation}</span>
        <span class="courseTitle">${course.title}</span>
      </span>
      <span class="right">
        <button>
          <img src="https://www.freeiconspng.com/thumbs/eye-icon/eye-icon-4.png">
        </button>
      </span>
    `;
    courseDiv.querySelector('button').onclick = () => addCourse(course); // Set up the button to add the course
    resultsContainer.appendChild(courseDiv);
  });
}

async function addCourse(course) {
  try {
    const result = await window.electronAPI.addCourse(course);
    
    // Check if the course is already being watched
    if (result.alreadyWatched) {
      alert(`Already watching ${result.courseName}: ${result.courseTitle}`);
      return;
    }
    
    // If there was an error
    if (result.error) {
      alert(`Error: ${result.error}`);
      return;
    }
    
    // Add course to UI
    addWatchedCourse(result.courseId, result.courseName, result.courseTitle);
  } catch (error) {
    console.error("Error adding course:", error);
  }
}

function addWatchedCourse(courseId, courseName, courseTitle) {
  console.log(`Renderer: Adding course to UI: ${courseId} - ${courseName} - ${courseTitle}`);
  
  // Check if the course is already being displayed
  if (document.getElementById(`course-${courseId}`)) {
    console.log(`Course ${courseId} already in UI, skipping`);
    return;
  }
  
  const courseDiv = document.createElement('div');
  courseDiv.classList.add('watched-course');
  courseDiv.id = `course-${courseId}`;
  courseDiv.innerHTML = `
    <span class="left">
      <span class="courseNum">${courseName}</span>
      <span class="courseTitle">${courseTitle}</span>
    </span>
    <span class="right">
      <span id="status-${courseId}" class="status status-checking">
        <span class="loading"><img src="loading.png"/></span>
      </span>
      <button class="details-btn" title="View course details">
        <i class="fas fa-chart-bar"></i>
      </button>
      <button class="remove-btn" onclick="removeCourse('${courseId}')">
        <i class="fas fa-trash"></i>
      </button>
    </span>
  `;
  
  // Add click handler for the details button
  courseDiv.querySelector('.details-btn').addEventListener('click', () => {
    viewCourseDetails(courseId);
  });
  
  const watchedCoursesEl = document.getElementById('watchedCourses');
  watchedCoursesEl.appendChild(courseDiv);
  console.log(`Added course ${courseId} to UI. Current watchedCourses children: ${watchedCoursesEl.children.length}`);
}

// Make the functions global so they can be accessed from HTML
window.searchCourses = searchCourses;
window.addCourse = addCourse;
window.removeCourse = async function(courseId) {
  try {
    if (confirm('Are you sure you want to stop watching this course?')) {
      const result = await window.electronAPI.removeCourse(courseId);
      if (result.success) {
        // Remove from UI
        const courseElement = document.getElementById(`course-${courseId}`);
        if (courseElement) {
          courseElement.remove();
        }
      }
    }
  } catch (error) {
    console.error("Error removing course:", error);
  }
};

// Set up event listeners when the page loads
function setupEventListeners() {
  console.log("Setting up event listeners");
  
  // Listen for updates about courses
  window.electronAPI.onCourseUpdate((event, { courseId, status, availableSeats }) => {
    console.log(`Received course update for ${courseId}`);
    const statusEl = document.getElementById(`status-${courseId}`);
    if (!statusEl) {
      console.log(`Could not find status element for course ${courseId}`);
      return;
    }
    
    statusEl.innerHTML = '';
    let openSeats = 0;
    let waitlist = false;
    
    for (let i in status) {
      if (status[i].status == "OPEN") {
        openSeats += status[i].availableSeats;
      } else if (status[i].status == "WAITLISTED") {
        waitlist = true;
      }
    }
    
    if (openSeats > 0) {
      statusEl.classList.remove('status-checking', 'status-waitlisted', 'status-closed');
      statusEl.classList.add('status-open');
      statusEl.innerHTML = `Open: ${openSeats}`;
    } else if (waitlist) {
      statusEl.classList.remove('status-checking', 'status-open', 'status-closed');
      statusEl.classList.add('status-waitlisted');
      statusEl.innerHTML = 'Waitlisted';
    } else {
      statusEl.classList.remove('status-checking', 'status-open', 'status-waitlisted');
      statusEl.classList.add('status-closed');
      statusEl.innerHTML = 'Closed';
    }
  });

  window.electronAPI.onLoadCourse((event, courseId) => {
    console.log(`Received course load event for ${courseId}`);
    const statusEl = document.getElementById(`status-${courseId}`);
    if (statusEl) {
      statusEl.innerHTML = '<span class="loading"><img src="loading.png"/></span>';
    } else {
      console.log(`Could not find status element for course ${courseId}`);
    }
  });

  // Listen for add-watched-course events when loading saved courses
  window.electronAPI.onAddWatchedCourse((event, data) => {
    console.log(`Renderer: Received add-watched-course event with data:`, data);
    if (data && data.courseId && data.courseName && data.courseTitle) {
      addWatchedCourse(data.courseId, data.courseName, data.courseTitle);
    } else {
      console.error("Received incomplete course data:", data);
    }
  });

  window.electronAPI.onApiLiveStatus((status) => {
    updateApiLiveIndicator(status.isLive);
  });
}

// Create a function to update the API status indicator
function updateApiLiveIndicator(isLive) {
  // Get or create the status indicator
  let liveIndicator = document.getElementById('api-live-indicator');
  
  if (!liveIndicator) {
    // Create indicator if it doesn't exist
    liveIndicator = document.createElement('div');
    liveIndicator.id = 'api-live-indicator';
    
    // Find where to insert it in the navbar (next to settings)
    const settingsBtn = document.getElementById('settingsButton');
    if (settingsBtn && settingsBtn.parentNode) {
      settingsBtn.parentNode.insertBefore(liveIndicator, settingsBtn);
    } else {
      document.querySelector('.navbar').appendChild(liveIndicator);
    }
  }
  
  // Update the indicator
  liveIndicator.className = isLive ? 'live-status online' : 'live-status offline';
  liveIndicator.innerHTML = isLive ? 'LIVE' : 'OFFLINE';
}

function openSettingsWindow() {
  window.electronAPI.openSettings();
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Content Loaded");
  initTermSelector();
  setupEventListeners();
});

async function viewCourseDetails(courseId) {
  const course = await window.electronAPI.getCourseData(courseId);
  if (!course) return;
  
  // Fetch detailed course data including prerequisites
  const detailedCourseData = course.data;
  
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'course-detail-modal';
  
  // Create a more detailed modal structure with better organization
  modal.innerHTML = `
    <div class="course-detail-content">
      <div class="course-detail-header">
        <h2>${course.courseDesignation}: ${course.title}</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="course-detail-tabs">
        <button class="tab-btn active" data-tab="info">Course Info</button>
        <button class="tab-btn" data-tab="schedule">Schedule</button>
        <button class="tab-btn" data-tab="grades">Grade Distribution</button>
        <button class="tab-btn" data-tab="similar">Similar Courses</button>
        <button class="tab-btn" data-tab="textbooks">Textbooks</button>
      </div>
      <div class="course-detail-body">
        <div id="info-tab" class="tab-content active">
          <div class="course-status-banner">
            <span id="modal-course-status">Loading...</span>
          </div>
          
          <div class="course-info-grid">
            <div class="info-column">
              <div class="course-info-section">
                <h3>Basic Information</h3>
                <p><strong>Course ID:</strong> ${courseId}</p>
                <p><strong>Credits:</strong> ${detailedCourseData[0]?.creditRange || 'N/A'}</p>
                <p><strong>Mode:</strong> ${detailedCourseData[0]?.modesOfInstruction?.join(', ') || 'N/A'}</p>
              </div>
              
              <div class="course-description-section" id="course-description">
                <h3>Course Description</h3>
                <div class="description-loading">
                  <span class="loading-spinner"></span> Loading description...
                </div>
              </div>
              
              <div class="enrollment-counts">
                ${detailedCourseData[0]?.enrollmentStatus ? `
                  <div class="count-box">
                    <div class="count-number">${detailedCourseData[0].enrollmentStatus.capacity}</div>
                    <div class="count-label">Total Seats</div>
                  </div>
                  <div class="count-box">
                    <div class="count-number">${detailedCourseData[0].enrollmentStatus.currentlyEnrolled}</div>
                    <div class="count-label">Enrolled</div>
                  </div>
                  ${detailedCourseData[0].enrollmentStatus.waitlistCapacity > 0 ? `
                    <div class="count-box">
                      <div class="count-number">${detailedCourseData[0].enrollmentStatus.waitlistCurrentSize}/${detailedCourseData[0].enrollmentStatus.waitlistCapacity}</div>
                      <div class="count-label">Waitlist</div>
                    </div>
                  ` : ''}
                  <div class="count-box ${detailedCourseData[0].enrollmentStatus.openSeats > 0 ? 'seats-available' : 'no-seats'}">
                    <div class="count-number">${detailedCourseData[0].enrollmentStatus.openSeats}</div>
                    <div class="count-label">Available</div>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Prerequisites will be inserted here by displayPrerequisites() -->
            <div class="info-column prereq-column" id="prereq-container">
            </div>
          </div>

          <div class="course-instructor-section">
            ${detailedCourseData.map(section => {
              const instructor = section.sections?.[0]?.instructor;
              if (!instructor) return '';
              
              return `
                <div class="instructor-card">
                  <div class="instructor-avatar" style="background-color: #9a0005;">
                    ${instructor.name?.first?.charAt(0) || ''}${instructor.name?.last?.charAt(0) || ''}
                  </div>
                  <div class="instructor-details">
                    <div class="instructor-name">${instructor.name?.first || ''} ${instructor.name?.last || ''}</div>
                    <div class="instructor-email">${instructor.email || ''}</div>
                    ${section.sections?.[0]?.type ? `
                      <div class="section-badge">${section.sections[0].type} ${section.sections[0].sectionNumber}</div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <div id="schedule-tab" class="tab-content">
          <div class="schedule-container">
            <div class="weekly-schedule">
              <div class="schedule-header">
                <div class="time-column"></div>
                <div class="day-column">Monday</div>
                <div class="day-column">Tuesday</div>
                <div class="day-column">Wednesday</div>
                <div class="day-column">Thursday</div>
                <div class="day-column">Friday</div>
              </div>
              <div class="schedule-body" id="schedule-grid">
                <!-- Will be populated dynamically -->
              </div>
            </div>
            
            <div class="meeting-info">
              <h3>Section Details</h3>
              <div class="meeting-list">
                ${detailedCourseData.map((section, index) => {
                  const meetings = section.classMeetings || [];
                  
                  return meetings.filter(m => m.meetingType === 'CLASS').map(meeting => `
                    <div class="meeting-item">
                      <div class="meeting-header">
                        <div class="meeting-section">Section ${section.sections?.[0]?.sectionNumber || ''}</div>
                        <div class="meeting-days">
                          <span class="meeting-day ${meeting.monday ? 'active' : ''}">M</span>
                          <span class="meeting-day ${meeting.tuesday ? 'active' : ''}">T</span>
                          <span class="meeting-day ${meeting.wednesday ? 'active' : ''}">W</span>
                          <span class="meeting-day ${meeting.thursday ? 'active' : ''}">R</span>
                          <span class="meeting-day ${meeting.friday ? 'active' : ''}">F</span>
                        </div>
                      </div>
                      <div class="meeting-details">
                        <div class="meeting-time">${formatTime(meeting.meetingTimeStart)} - ${formatTime(meeting.meetingTimeEnd)}</div>
                        <div class="meeting-location">${meeting.building?.buildingName || ''} ${meeting.room || ''}</div>
                      </div>
                    </div>
                  `).join('');
                }).join('')}
              </div>
            </div>
          </div>
        </div>
        
        <div id="grades-tab" class="tab-content">
          <div class="grades-loading">Loading grade data...</div>
          <div class="grades-container">
            <div class="grades-chart-container">
              <canvas id="grades-chart"></canvas>
            </div>
            <div class="grade-data-table"></div>
            <div class="grades-stats">
              <h3>Historical Grade Stats</h3>
              <div id="grades-stats-content"></div>
            </div>
          </div>
        </div>
        
        <div id="similar-tab" class="tab-content">
          <div class="similar-courses-loading">
            <span class="loading-spinner"></span> Finding similar courses...
          </div>
          <div id="similar-courses-container" class="similar-courses-container">
            <!-- Will be populated dynamically -->
          </div>
        </div>
        
        <div id="textbooks-tab" class="tab-content">
          <div class="textbooks-loading">
            <span class="loading-spinner"></span> Loading textbook information...
          </div>
          <div id="textbooks-container" class="textbooks-container">
            <!-- Will be populated dynamically -->
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  if (detailedCourseData && detailedCourseData.length > 0) {
    const prereqContainer = document.getElementById('prereq-container');
    if (prereqContainer) {
      displayPrerequisites(detailedCourseData[0], prereqContainer);
    }
    
    // Generate the schedule grid
    setTimeout(() => {
      if (document.getElementById('schedule-grid')) {
        generateScheduleGrid(detailedCourseData);
      }
    }, 100);
  }
  
  // Close button functionality
  modal.querySelector('.close-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Tab switching functionality
  modal.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      modal.querySelector(`#${btn.dataset.tab}-tab`).classList.add('active');

      console.log(`Tab switched to: ${btn.dataset.tab}`);
      
      if (btn.dataset.tab === 'grades' && !modal.querySelector('#grades-chart').hasAttribute('data-loaded')) {
        loadGradeData(course.courseDesignation);
      }
      else if (btn.dataset.tab === 'similar') {
        console.log(`Loading similar courses for ${course.courseDesignation}`);
        loadSimilarCourses(course);
      }
      else if (btn.dataset.tab === 'textbooks') {
        loadTextbookInfo(course);
      }
    });
  });
  
  // Update the course status in the modal
  updateModalCourseStatus(courseId);
  
  // Load course description (new feature)
  loadCourseDescription(course);
}

// Function to display prerequisites in a more visually appealing way
function displayPrerequisites(course, container) {
  const requirementGroups = course.enrollmentRequirementGroups?.catalogRequirementGroups || [];
  
  if (!container) {
    container = document.getElementById('prereq-container');
    if (!container) return;
  }
  
  if (requirementGroups.length === 0) {
    container.innerHTML = `
      <div class="course-info-section">
        <h3>Prerequisites</h3>
        <p><span class="prereq-none">None</span></p>
      </div>
    `;
    return;
  }
  
  const prereqSection = document.createElement('div');
  prereqSection.className = 'course-info-section';
  prereqSection.innerHTML = '<h3>Prerequisites</h3>';
  
  requirementGroups.forEach(requirement => {
    const prereqContent = createImprovedPrereqDisplay(requirement.description);
    prereqSection.appendChild(prereqContent);
  });
  
  container.appendChild(prereqSection);
}

// Enhanced grade chart visualization to match app style
function renderGradeChart(gradeData) {
  const ctx = document.getElementById('grades-chart').getContext('2d');
  
  const cumulative = gradeData.cumulative;
  
  // Extract grade counts
  const data = [
    cumulative.aCount,
    cumulative.abCount,
    cumulative.bCount,
    cumulative.bcCount,
    cumulative.cCount,
    cumulative.dCount,
    cumulative.fCount
  ];
  
  // Calculate total count of letter grades for percentage calculation
  const totalGradeCount = data.reduce((sum, count) => sum + count, 0);
  
  // Calculate percentages with 1 decimal place
  const percentages = data.map(count => ((count / totalGradeCount) * 100).toFixed(1));
  
  // Create arrays for both the display data and the raw counts
  const counts = [...data];
  
  // Create and configure the chart with improved aesthetics matching app style
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['A', 'AB', 'B', 'BC', 'C', 'D', 'F'],
      datasets: [{
        label: 'Grade Distribution',
        data: percentages,
        backgroundColor: [
          'rgba(33, 150, 83, 0.8)',   // A - green
          'rgba(69, 170, 89, 0.8)',   // AB - lighter green
          'rgba(86, 204, 242, 0.8)',  // B - light blue
          'rgba(45, 149, 191, 0.8)',  // BC - blue
          'rgba(255, 193, 7, 0.8)',   // C - yellow
          'rgba(255, 111, 0, 0.8)',   // D - orange
          'rgba(185, 27, 27, 0.8)'    // F - badger red
        ],
        borderColor: [
          'rgba(33, 150, 83, 1)',
          'rgba(69, 170, 89, 1)',
          'rgba(86, 204, 242, 1)',
          'rgba(45, 149, 191, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(255, 111, 0, 1)',
          'rgba(185, 27, 27, 1)'
        ],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Percentage',
            font: {
              family: "'Inter', sans-serif",
              size: 12
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: function(value) {
              return value + '%';
            },
            font: {
              family: "'Inter', sans-serif"
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              weight: 'bold'
            }
          }
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(154, 0, 5, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          titleFont: {
            family: "'Inter', sans-serif",
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            family: "'Inter', sans-serif",
            size: 13
          },
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 6,
          cornerRadius: 6,
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const count = counts[index];
              return `${context.raw}% (${count} students)`;
            }
          }
        },
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Historical Grade Distribution',
          color: '#333',
          font: {
            family: "'Inter', sans-serif",
            size: 16,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        }
      }
    }
  });
  
  // Display enhanced data table with grade stats
  const chartContainer = document.querySelector('.grades-container');
  const dataTable = chartContainer.querySelector('.grade-data-table');
  dataTable.innerHTML = `
    <table class="grade-stats-table">
      <tr>
        <th>Grade</th>
        <th>A</th>
        <th>AB</th>
        <th>B</th>
        <th>BC</th>
        <th>C</th>
        <th>D</th>
        <th>F</th>
      </tr>
      <tr>
        <td>Percentage</td>
        ${percentages.map(p => `<td>${p}%</td>`).join('')}
      </tr>
      <tr>
        <td>Count</td>
        ${counts.map(c => `<td>${c}</td>`).join('')}
      </tr>
    </table>
  `;
}

// Make sure to add this to your global window object
window.updateModalCourseStatus = updateModalCourseStatus;

// Make viewCourseDetails globally accessible
window.viewCourseDetails = viewCourseDetails;

// Make functions available globally
window.openSettingsWindow = openSettingsWindow;

// Helper function to split text by top-level delimiters respecting parentheses
function splitTopLevel(text, delimiter) {
  const results = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (depth === 0 && text.slice(i).match(delimiter)?.index === 0) {
      // Found a top-level delimiter
      const match = text.slice(i).match(delimiter)[0];
      if (current.trim()) {
        results.push(current.trim());
      }
      current = '';
      i += match.length - 1; // Skip the delimiter
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    results.push(current.trim());
  }
  
  return results;
}


// Function to format milliseconds time to 12-hour format
function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Function to update the modal course status with enhanced styling
function updateModalCourseStatus(courseId) {
  const statusEl = document.getElementById(`status-${courseId}`);
  const modalStatusEl = document.getElementById('modal-course-status');
  
  if (!statusEl || !modalStatusEl) return;
  
  // Copy the status from the main UI to the modal
  const statusText = statusEl.textContent || statusEl.innerText;
  modalStatusEl.textContent = statusText;
  
  // Copy the status class with enhanced styling
  modalStatusEl.className = '';
  if (statusEl.classList.contains('status-open')) {
    modalStatusEl.className = 'modal-status-open';
  } else if (statusEl.classList.contains('status-waitlisted')) {
    modalStatusEl.className = 'modal-status-waitlisted';
  } else if (statusEl.classList.contains('status-closed')) {
    modalStatusEl.className = 'modal-status-closed';
  }
}

// Function to load and render grade data with enhanced visualization
async function loadGradeData(courseDesignation) {
  const gradesTab = document.querySelector('#grades-tab');
  const loadingEl = gradesTab.querySelector('.grades-loading');
  const containerEl = gradesTab.querySelector('.grades-container');
  
  try {
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    
    // Change searchCourseUuid to searchCourseUUID (note the capitalization)
    const courseUuid = await window.electronAPI.searchCourseUUID(courseDesignation);
    
    if (!courseUuid) {
      loadingEl.textContent = 'Grade data not available for this course';
      return;
    }
    
    // Then fetch the grade data
    const gradeData = await window.electronAPI.fetchCourseGrades(courseUuid);
    
    if (!gradeData) {
      loadingEl.textContent = 'Failed to load grade data';
      return;
    }
    
    // Render the grade chart and statistics
    renderGradeChart(gradeData);
    renderGradeStats(gradeData);
    
    document.querySelector('#grades-chart').setAttribute('data-loaded', 'true');
    loadingEl.style.display = 'none';
    containerEl.style.display = 'flex';
    
  } catch (error) {
    console.error('Error loading grade data:', error);
    loadingEl.textContent = 'Error: Failed to load grade data';
  }
}

// Function to render grade statistics in a visually appealing way
function renderGradeStats(gradeData) {
  const statsEl = document.getElementById('grades-stats-content');
  const cumulative = gradeData.cumulative;
  
  // Calculate GPA
  const gpaPoints = (
    cumulative.aCount * 4.0 +
    cumulative.abCount * 3.5 +
    cumulative.bCount * 3.0 +
    cumulative.bcCount * 2.5 +
    cumulative.cCount * 2.0 +
    cumulative.dCount * 1.0
  );
  
  const gradeCount = (
    cumulative.aCount +
    cumulative.abCount +
    cumulative.bCount +
    cumulative.bcCount +
    cumulative.cCount +
    cumulative.dCount +
    cumulative.fCount
  );
  
  const avgGPA = (gpaPoints / gradeCount).toFixed(2);
  const aRate = ((cumulative.aCount / gradeCount) * 100).toFixed(1);
  
  // Get the most recent term data
  const recentTermData = gradeData.courseOfferings.sort((a, b) => b.termCode - a.termCode)[0];
  const recentInstructor = recentTermData.sections[0].instructors[0]?.name || 'Unknown';
  
  // Create stat items
  statsEl.innerHTML = '';
  const gradeStatItems = document.createElement('div');
  gradeStatItems.className = 'grade-stat-items';
  statsEl.appendChild(gradeStatItems);
  
  // Create recent instructor stat
  const instructorStat = document.createElement('div');
  instructorStat.className = 'grade-stat-item';
  instructorStat.innerHTML = `
    <div class="grade-stat-value">${recentInstructor}</div>
    <div class="grade-stat-label">Recent Instructor</div>
  `;
  gradeStatItems.appendChild(instructorStat);
  
  // Create GPA stat
  const gpaStat = document.createElement('div');
  gpaStat.className = 'grade-stat-item';
  gpaStat.innerHTML = `
    <div class="grade-stat-value">${avgGPA}</div>
    <div class="grade-stat-label">Avg. GPA</div>
  `;
  gradeStatItems.appendChild(gpaStat);
  
  // Create A Rate stat
  const aRateStat = document.createElement('div');
  aRateStat.className = 'grade-stat-item';
  aRateStat.innerHTML = `
    <div class="grade-stat-value">${aRate}%</div>
    <div class="grade-stat-label">A Rate</div>
  `;
  gradeStatItems.appendChild(aRateStat);
  
  // Create total students stat
  const totalStat = document.createElement('div');
  totalStat.className = 'grade-stat-item';
  totalStat.innerHTML = `
    <div class="grade-stat-value">${cumulative.total}</div>
    <div class="grade-stat-label">Total Students</div>
  `;
  gradeStatItems.appendChild(totalStat);
  
  // Add term-by-term breakdown (collapsible)
  const termBreakdown = document.createElement('div');
  termBreakdown.className = 'term-breakdown';
  termBreakdown.innerHTML = `
    <div class="term-breakdown-toggle">
      Term-by-Term Breakdown
      <span class="toggle-icon">▼</span>
    </div>
    <div class="term-breakdown-content">
      <table class="term-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Instructor</th>
            <th>Avg GPA</th>
            <th>A Rate</th>
            <th>Students</th>
          </tr>
        </thead>
        <tbody>
          ${gradeData.courseOfferings.map(term => {
            const termGradeCount = (
              term.cumulative.aCount +
              term.cumulative.abCount +
              term.cumulative.bCount +
              term.cumulative.bcCount +
              term.cumulative.cCount +
              term.cumulative.dCount +
              term.cumulative.fCount
            );
            
            const termGpaPoints = (
              term.cumulative.aCount * 4.0 +
              term.cumulative.abCount * 3.5 +
              term.cumulative.bCount * 3.0 +
              term.cumulative.bcCount * 2.5 +
              term.cumulative.cCount * 2.0 +
              term.cumulative.dCount * 1.0
            );
            
            const termAvgGPA = termGradeCount > 0 ? (termGpaPoints / termGradeCount).toFixed(2) : "N/A";
            const aRate = termGradeCount > 0 ? ((term.cumulative.aCount / termGradeCount) * 100).toFixed(0) + "%" : "N/A";
            const instructor = term.sections[0].instructors[0]?.name.split(' ')[1] || 'Unknown';
            
            return `
              <tr>
                <td>${formatTermCode(term.termCode)}</td>
                <td>${instructor}</td>
                <td>${termAvgGPA}</td>
                <td>${aRate}</td>
                <td>${term.cumulative.total}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  statsEl.appendChild(termBreakdown);
  
  // Toggle functionality for term breakdown
  termBreakdown.querySelector('.term-breakdown-toggle').addEventListener('click', function() {
    const content = termBreakdown.querySelector('.term-breakdown-content');
    const icon = termBreakdown.querySelector('.toggle-icon');
    
    if (content.style.display === 'none' || content.style.display === '') {
      content.style.display = 'block';
      icon.textContent = '▲';
    } else {
      content.style.display = 'none';
      icon.textContent = '▼';
    }
  });
}
// Helper function to format term code to semester and year
function formatTermCode(termCode) {
  const termMap = {
    '4': 'Spring',
    '6': 'Summer',
    '2': 'Fall'
  };
  
  const termStr = termCode.toString();
  const centuryYear = termStr.substring(0, 3);
  const term = termStr.substring(3);
  
  let year;
  if (centuryYear === '112') {
    year = '2012';
  } else if (termMap[term] == "Fall") {
    year = '20' + (parseInt(centuryYear.substring(1)) - 1);
  }
  else {
    year = '20' + centuryYear.substring(1);
  }
  
  return `${termMap[term]} ${year}`;
}

// Function to create an improved prerequisite display
// Improved version of the function that handles course alternatives
function createImprovedPrereqDisplay(prereqText) {
  // Replace "graduate/professional standing" with a cleaner term
  prereqText = prereqText.replace(/graduate\/professional standing/gi, "Graduate Standing");
  
  // Clean up the text by removing unnecessary parentheses and normalizing spaces
  prereqText = prereqText.replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s+/g, ' ').trim();
  
  const container = document.createElement('div');
  container.className = 'prereq-container';
  
  // Special case for "declared in X" without commas, which isn't a logical AND
  if (prereqText.includes('declared in') && !prereqText.includes(' and ') && !prereqText.match(/\bor\b/i)) {
    const parts = prereqText.split(/,\s*(?=[A-Z])/); // Split by commas followed by uppercase letter
    
    if (parts.length > 1) {
      const requirementsHeader = document.createElement('div');
      requirementsHeader.className = 'prereq-requirements-header';
      requirementsHeader.textContent = 'Complete ALL of the following:';
      container.appendChild(requirementsHeader);
      
      const requirementsList = document.createElement('ul');
      requirementsList.className = 'prereq-requirements-list';
      
      parts.forEach(part => {
        const reqItem = document.createElement('li');
        formatCourseItem(part.trim(), reqItem);
        requirementsList.appendChild(reqItem);
      });
      
      container.appendChild(requirementsList);
      return container;
    }
  }
  
  // Handle special case for alternative courses with shared subjects
  if (prereqText.match(/\(([A-Z]+(?:\s+[A-Z]+)*)\s+\d{3}(?:,\s*\d{3})+(?:\s+or\s+\d{3})+\)/i)) {
    // Extract each course subject pattern and process separately
    let modifiedText = prereqText;
    const regex = /\(([A-Z]+(?:\s+[A-Z]+)*)\s+(\d{3}(?:,\s*\d{3})*(?:\s+or\s+\d{3})*)\)/gi;
    let match;
    
    while ((match = regex.exec(prereqText)) !== null) {
      const subject = match[1];
      const coursesList = match[2];
      
      // Create an organized display for this course group
      const alternativesDiv = document.createElement('div');
      alternativesDiv.className = 'prereq-course-alt-group';
      
      const header = document.createElement('div');
      header.className = 'prereq-alt-header';
      header.textContent = `Complete ONE ${subject} course from:`;
      alternativesDiv.appendChild(header);
      
      const courseListEl = document.createElement('ul');
      courseListEl.className = 'prereq-alt-courses';
      
      // Split the course numbers by commas and "or"
      const courseNumbers = coursesList.split(/\s*(?:,|or)\s*/).filter(Boolean);
      courseNumbers.forEach(courseNum => {
        const courseItem = document.createElement('li');
        courseItem.innerHTML = `<span class="prereq-course">${subject} ${courseNum.trim()}</span>`;
        courseListEl.appendChild(courseItem);
      });
      
      alternativesDiv.appendChild(courseListEl);
      
      // Replace the pattern in the text with a placeholder
      modifiedText = modifiedText.replace(match[0], `[COURSE_GROUP_${alternativesDiv.id}]`);
      
      // If this is the only text, return it directly
      if (prereqText.trim() === match[0].trim()) {
        container.appendChild(alternativesDiv);
        return container;
      }
      
      // Otherwise store for later
      container.appendChild(alternativesDiv);
    }
    
    // If we processed some course groups and have more text, continue with that
    if (modifiedText !== prereqText) {
      prereqText = modifiedText;
    }
  }
  
  // Handle prereqs with commas that aren't logical separators (e.g., "COMP SCI 400, senior standing")
  if (prereqText.includes(',') && !prereqText.includes(' and ') && !prereqText.match(/\bor\b/i)) {
    // This is likely a list of requirements with a comma rather than "and"
    const parts = [];
    let inCourse = false;
    let current = "";
    
    // Handle special case with comma-separated requirements that aren't logical ANDs
    const singleReq = document.createElement('div');
    singleReq.className = 'prereq-single-requirement';
    formatCourseItem(prereqText, singleReq);
    container.appendChild(singleReq);
    return container;
  }
  
  // Check for OR conditions at the top level
  if (prereqText.match(/\bor\b/i)) {
    // Split by top-level "or" conditions
    const orGroups = splitTopLevel(prereqText, /\bor\b/i);
    
    // Create a header for the options
    const optionsHeader = document.createElement('div');
    optionsHeader.className = 'prereq-options-header';
    optionsHeader.textContent = 'Complete ONE of the following:';
    container.appendChild(optionsHeader);
    
    const optionsList = document.createElement('div');
    optionsList.className = 'prereq-options-list';
    container.appendChild(optionsList);
    
    // Process each OR option
    orGroups.forEach((orGroup, index) => {
      const optionItem = document.createElement('div');
      optionItem.className = 'prereq-option-item';
      
      // Handle options with AND conditions or complex groupings
      if (orGroup.match(/\band\b/i) || orGroup.includes('(')) {
        optionItem.innerHTML = `<div class="prereq-option-number">${index + 1}</div>`;
        const optionContent = document.createElement('div');
        optionContent.className = 'prereq-option-content';
        
        if (orGroup.match(/\band\b/i)) {
          // Format AND conditions for clarity
          const andItems = splitTopLevel(orGroup, /\band\b/i);
          
          const andHeader = document.createElement('div');
          andHeader.className = 'prereq-and-header';
          andHeader.textContent = 'All of these:';
          optionContent.appendChild(andHeader);
          
          const andList = document.createElement('ul');
          andList.className = 'prereq-and-list';
          
          andItems.forEach(item => {
            const andItem = document.createElement('li');
            formatCourseItem(item, andItem);
            andList.appendChild(andItem);
          });
          
          optionContent.appendChild(andList);
        } else {
          // Handle complex expressions with parentheses
          formatCourseItem(orGroup, optionContent);
        }
        
        optionItem.appendChild(optionContent);
      } else {
        // Simple single option
        optionItem.innerHTML = `
          <div class="prereq-option-number">${index + 1}</div>
          <div class="prereq-option-content single-item"></div>
        `;
        formatCourseItem(orGroup, optionItem.querySelector('.single-item'));
      }
      
      optionsList.appendChild(optionItem);
    });
    
  } else if (prereqText.match(/\band\b/i)) {
    // Only AND conditions - all requirements must be met
    const andItems = splitTopLevel(prereqText, /\band\b/i);
    
    const requirementsHeader = document.createElement('div');
    requirementsHeader.className = 'prereq-requirements-header';
    requirementsHeader.textContent = 'Complete ALL of the following:';
    container.appendChild(requirementsHeader);
    
    const requirementsList = document.createElement('ul');
    requirementsList.className = 'prereq-requirements-list';
    
    andItems.forEach(item => {
      const reqItem = document.createElement('li');
      formatCourseItem(item, reqItem);
      requirementsList.appendChild(reqItem);
    });
    
    container.appendChild(requirementsList);
    
  } else {
    // Just a single requirement
    const singleReq = document.createElement('div');
    singleReq.className = 'prereq-single-requirement';
    formatCourseItem(prereqText, singleReq);
    container.appendChild(singleReq);
  }
  
  return container;
}

// Improved function to format course codes with proper highlighting
function formatCourseItem(text, element) {
  // Special handling for "declared in" statements
  if (text.match(/declared\s+in\b/i)) {
    element.textContent = text;
    return;
  }

  // Handle "senior standing" and other standing phrases
  if (text.match(/\b(senior|junior|sophomore|freshman)\s+standing\b/i) ||
      text.match(/\bgraduate(\s+|\/)standing\b/i)) {
    const match = text.match(/\b(senior|junior|sophomore|freshman|graduate(\s+|\/))\s*standing\b/i);
    if (match) {
      const standingText = match[0];
      const otherText = text.replace(standingText, '').trim();
      
      if (otherText) {
        element.innerHTML = `<span class="prereq-standing">${standingText}</span>${otherText.startsWith(',') ? '' : ' '}${otherText}`;
      } else {
        element.innerHTML = `<span class="prereq-standing">${standingText}</span>`;
      }
      return;
    }
  }
  
  // Handle complex cases with multiple course alternatives in a comma-separated list
  if (text.match(/[A-Z]+\s+\d{3}[A-Z]*\s*,\s*\d{3}[A-Z]*/i)) {
    // This is likely a list of courses with same subject but different numbers
    const mainSubjectMatch = text.match(/^([A-Z]+(?:\s+[A-Z]+)*)\s+/i);
    
    if (mainSubjectMatch) {
      const subject = mainSubjectMatch[1];
      const afterSubject = text.substring(mainSubjectMatch[0].length);
      
      // Use regex to find all course numbers and "or" conjunctions
      const parts = [];
      let currentPart = "";
      let matches = afterSubject.matchAll(/(\d{3}[A-Z]*)|(\s*,\s*)|(\s+or\s+)|([^,\d\s]+)/gi);
      
      for (const match of matches) {
        if (match[1]) {
          // This is a course number
          if (currentPart) parts.push(currentPart);
          parts.push(`${subject} ${match[1]}`);
          currentPart = "";
        } else if (match[2] || match[3]) {
          // This is a separator (comma or "or")
          currentPart = match[0];
        } else if (match[4]) {
          // This is some other text
          currentPart += match[0];
        }
      }
      
      if (currentPart) parts.push(currentPart);
      
      // Now reconstruct with proper highlighting
      let formattedText = "";
      parts.forEach(part => {
        if (part.match(/^[A-Z]+(?:\s+[A-Z]+)*\s+\d{3}[A-Z]*/i)) {
          // This is a course code
          formattedText += `<span class="prereq-course">${part}</span>`;
        } else if (part.match(/\//) && part.match(/[A-Z]+\/[A-Z]+/)) {
          // This is a joint course like MATH/STAT
          formattedText += `<span class="prereq-course">${part}</span>`;
        } else {
          formattedText += part;
        }
      });
      
      element.innerHTML = formattedText;
      return;
    }
  }
  
  // Handle cross-listed courses (e.g., COMP SCI/MATH 240)
  const crossListedMatch = text.match(/([A-Z]+(?:\s+[A-Z]+)*\/[A-Z]+(?:\s+[A-Z]+)*)\s+(\d{3}[A-Z]*)/i);
  if (crossListedMatch) {
    const courseName = `${crossListedMatch[1]} ${crossListedMatch[2]}`;
    const otherText = text.replace(courseName, '').trim();
    
    if (otherText) {
      element.innerHTML = `<span class="prereq-course">${courseName}</span>${otherText.startsWith(',') ? '' : ' '}${otherText}`;
    } else {
      element.innerHTML = `<span class="prereq-course">${courseName}</span>`;
    }
    return;
  }
  
  // Handle standard course codes like "COMP SCI 354"
  const courseMatch = text.match(/([A-Z]+(?:\s+[A-Z]+)*)\s+(\d{3}[A-Z]*)/i);
  if (courseMatch) {
    const courseName = `${courseMatch[1]} ${courseMatch[2]}`;
    const otherText = text.replace(courseName, '').trim();
    
    if (otherText) {
      element.innerHTML = `<span class="prereq-course">${courseName}</span>${otherText.startsWith(',') ? '' : ' '}${otherText}`;
    } else {
      element.innerHTML = `<span class="prereq-course">${courseName}</span>`;
    }
    return;
  }
  
  // Default case - just display the text
  element.textContent = text;
}

// Function to display prerequisites in a more visually appealing way
function displayPrerequisites(course, container) {
  const requirementGroups = course.enrollmentRequirementGroups?.catalogRequirementGroups || [];
  
  if (!container) {
    container = document.getElementById('prereq-container');
    if (!container) return;
  }
  
  if (requirementGroups.length === 0) {
    container.innerHTML = `
      <div class="course-info-section">
        <h3>Prerequisites</h3>
        <p><span class="prereq-none">None</span></p>
      </div>
    `;
    return;
  }
  
  const prereqSection = document.createElement('div');
  prereqSection.className = 'course-info-section';
  prereqSection.innerHTML = '<h3>Prerequisites</h3>';
  
  requirementGroups.forEach(requirement => {
    const prereqContent = createImprovedPrereqDisplay(requirement.description);
    prereqSection.appendChild(prereqContent);
  });
  
  container.appendChild(prereqSection);
}

// Function to format a course item with proper highlighting
// Function to format a course item with proper highlighting
function formatCourseItem(text, element) {
  // Handle complex cases with multiple course alternatives in a comma-separated list
  if (text.match(/[A-Z]+\s+\d{3}[A-Z]*\s*,\s*\d{3}[A-Z]*/i)) {
    // This is likely a list of courses with same subject but different numbers
    const mainSubjectMatch = text.match(/^([A-Z]+(?:\s+[A-Z]+)*)\s+/i);
    
    if (mainSubjectMatch) {
      const subject = mainSubjectMatch[1];
      const afterSubject = text.substring(mainSubjectMatch[0].length);
      
      // Use regex to find all course numbers and "or" conjunctions
      const parts = [];
      let currentPart = "";
      let matches = afterSubject.matchAll(/(\d{3}[A-Z]*)|(\s*,\s*)|(\s+or\s+)|([^,\d\s]+)/gi);
      
      for (const match of matches) {
        if (match[1]) {
          // This is a course number
          if (currentPart) parts.push(currentPart);
          parts.push(`${subject} ${match[1]}`);
          currentPart = "";
        } else if (match[2] || match[3]) {
          // This is a separator (comma or "or")
          currentPart = match[0];
        } else if (match[4]) {
          // This is some other text
          currentPart += match[0];
        }
      }
      
      if (currentPart) parts.push(currentPart);
      
      // Now reconstruct with proper highlighting
      let formattedText = "";
      parts.forEach(part => {
        if (part.match(/^[A-Z]+(?:\s+[A-Z]+)*\s+\d{3}[A-Z]*/i)) {
          // This is a course code
          formattedText += `<span class="prereq-course">${part}</span>`;
        } else if (part.match(/\//) && part.match(/[A-Z]+\/[A-Z]+/)) {
          // This is a joint course like MATH/STAT
          formattedText += `<span class="prereq-course">${part}</span>`;
        } else {
          formattedText += part;
        }
      });
      
      element.innerHTML = formattedText;
      return;
    }
  }
  
  // Handle cross-listed courses (e.g., COMP SCI/MATH 240)
  const crossListedMatch = text.match(/([A-Z]+(?:\s+[A-Z]+)*\/[A-Z]+(?:\s+[A-Z]+)*)\s+(\d{3}[A-Z]*)/i);
  if (crossListedMatch) {
    const courseName = `${crossListedMatch[1]} ${crossListedMatch[2]}`;
    const otherText = text.replace(courseName, '').trim();
    
    if (otherText) {
      element.innerHTML = `<span class="prereq-course">${courseName}</span> ${otherText}`;
    } else {
      element.innerHTML = `<span class="prereq-course">${courseName}</span>`;
    }
    return;
  }
  
  // Special case for graduate/professional standing
  if (text.match(/graduate( |\/)(standing|professional)/i)) {
    element.innerHTML = `<span class="prereq-standing">${text}</span>`;
    return;
  }
  
  // Handle standard course codes like "COMP SCI 354"
  const courseMatch = text.match(/([A-Z]+(?:\s+[A-Z]+)*)\s+(\d{3}[A-Z]*)/i);
  if (courseMatch) {
    const courseName = `${courseMatch[1]} ${courseMatch[2]}`;
    const otherText = text.replace(courseName, '').trim();
    
    if (otherText) {
      element.innerHTML = `<span class="prereq-course">${courseName}</span> ${otherText}`;
    } else {
      element.innerHTML = `<span class="prereq-course">${courseName}</span>`;
    }
    return;
  }
  
  // Default case - just display the text
  element.textContent = text;
}

// Generate a visual course schedule grid
function generateScheduleGrid(courseData) {
  const scheduleGrid = document.getElementById('schedule-grid');
  scheduleGrid.innerHTML = '';
  
  // Define time range (8:00 AM to 9:00 PM in 30 min increments)
  const startHour = 8; // 8 AM
  const endHour = 21;  // 9 PM
  const timeIncrement = 30; // minutes
  
  // Create a mapping of days
  const dayMap = {
    'monday': 0,
    'tuesday': 1, 
    'wednesday': 2,
    'thursday': 3,
    'friday': 4
  };
  
  // Generate time rows
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += timeIncrement) {
      const timeRow = document.createElement('div');
      timeRow.className = 'time-row';
      
      // Format time label (12-hour format)
      let timeLabel = '';
      const hourDisplay = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      
      // Only show the label on the hour marks
      if (min === 0) {
        timeLabel = `${hourDisplay}:00 ${ampm}`;
      }
      
      // Create time label column
      const timeCol = document.createElement('div');
      timeCol.className = 'time-label';
      timeCol.textContent = timeLabel;
      timeRow.appendChild(timeCol);
      
      // Create day cells
      for (let day = 0; day < 5; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.dataset.day = day;
        dayCell.dataset.hour = hour;
        dayCell.dataset.minute = min;
        timeRow.appendChild(dayCell);
      }
      
      scheduleGrid.appendChild(timeRow);
    }
  }
  
  // Place course meetings on the grid
  courseData.forEach((section, sectionIndex) => {
    // Skip if there are no class meetings
    if (!section.classMeetings || section.classMeetings.length === 0) return;
    
    // Only process CLASS meetings (not exams)
    section.classMeetings.filter(meeting => meeting.meetingType === 'CLASS').forEach(meeting => {
      // Figure out which days this meeting occurs on
      const days = [];
      if (meeting.monday) days.push('monday');
      if (meeting.tuesday) days.push('tuesday');
      if (meeting.wednesday) days.push('wednesday');
      if (meeting.thursday) days.push('thursday');
      if (meeting.friday) days.push('friday');
      
      days.forEach(day => {
        // Calculate start and end time in minutes since start of day
        const startTimeMillis = meeting.meetingTimeStart;
        const endTimeMillis = meeting.meetingTimeEnd;
        
        // Convert to hours and minutes
        const startHours = Math.floor(startTimeMillis / 3600000);
        const startMinutes = Math.floor((startTimeMillis % 3600000) / 60000);
        const endHours = Math.floor((endTimeMillis) / 3600000);
        const endMinutes = Math.floor((endTimeMillis % 3600000) / 60000);
        
        // Skip if outside our time range
        if (startHours < startHour || startHours >= endHour) return;
        
        // Calculate position and height
        const dayIndex = dayMap[day];
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;
        const duration = endTime - startTime; // in minutes
        
        // Get all cells in this day column
        const cells = scheduleGrid.querySelectorAll(`.day-cell[data-day="${dayIndex}"]`);
        
        // Find the closest cell to start time
        let startCell = null;
        let minDiff = Infinity;
        
        cells.forEach(cell => {
          const cellHour = parseInt(cell.dataset.hour);
          const cellMinute = parseInt(cell.dataset.minute);
          const cellTime = cellHour * 60 + cellMinute;
          const diff = Math.abs(cellTime - startTime);
          
          if (diff < minDiff) {
            minDiff = diff;
            startCell = cell;
          }
        });
        
        if (!startCell) return;
        
        // Create the meeting element
        const meetingEl = document.createElement('div');
        meetingEl.className = `course-meeting section-color-${sectionIndex % 5}`;
        
        // Calculate height based on duration
        const rowHeight = 30; // height of each 30-minute row in pixels
        const heightInPixels = (duration / timeIncrement) * rowHeight;
        
        // Get section information
        const sectionInfo = section.sections && section.sections.length > 0 ? 
          section.sections[0].type + " " + section.sections[0].sectionNumber : 
          "Section";
        
        // Get building and room
        const building = meeting.building && meeting.building.buildingName ? meeting.building.buildingName : "";
        const room = meeting.room ? meeting.room : "";
        const location = building || room ? `${building} ${room}`.trim() : "TBA";
        
        // Format the content
        meetingEl.innerHTML = `
          <div class="meeting-title">${sectionInfo}</div>
          <div class="meeting-time">${formatTime(meeting.meetingTimeStart)} - ${formatTime(meeting.meetingTimeEnd)}</div>
          <div class="meeting-location">${location}</div>
        `;
        
        // Set positioning and height
        meetingEl.style.top = (startCell.offsetTop) + 'px';
        meetingEl.style.height = heightInPixels + 'px';
        
        // Add to the day column
        startCell.appendChild(meetingEl);
      });
    });
  });
}

// NEW FEATURE: Load course description
// NEW FEATURE: Load course description
async function loadCourseDescription(course) {
  // Fix: Use the correct element IDs that match your HTML structure
  const descriptionSection = document.getElementById('course-description');
  if (!descriptionSection) return;
  
  const loadingElem = descriptionSection.querySelector('.description-loading');
  if (!loadingElem) return;
  
  // Create a container for the content if it doesn't exist
  let containerElem = descriptionSection.querySelector('.description-content');
  if (!containerElem) {
    containerElem = document.createElement('div');
    containerElem.className = 'description-content';
    descriptionSection.appendChild(containerElem);
  }
  
  if (!course || !course.courseDesignation) {
    containerElem.innerHTML = `
      <div class="description-error">
        <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h3>No Course Information</h3>
        <p>Course information is not available to retrieve the description.</p>
      </div>
    `;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
    return;
  }
  
  try {
    loadingElem.style.display = 'block';
    containerElem.style.display = 'none';
    
    // Rest of your existing code remains the same
    // Parse the course designation to get subject and number
    const designationParts = course.courseDesignation.split(' ');
    if (designationParts.length < 2) {
      throw new Error('Invalid course designation format');
    }
    
    // Extract the subject and course number
    const subject = designationParts.length > 2 ? 
      designationParts.slice(0, -1).join(' ') : 
      designationParts[0];
    
    const courseNumber = designationParts[designationParts.length - 1];
    
    // Fetch course syllabus/description based on the course code
    const courseInfo = await window.electronAPI.fetchCourseSyllabus(
      course
    );
    
    if (!courseInfo) {
      throw new Error('No course information available');
    }
    
    // Generate HTML for course description - simplify for the smaller space
    let content = `
      <div class="course-description-content">
        <p>${courseInfo.description || 'No description available.'}</p>
      </div>
    `;
    
    if (courseInfo.learningOutcomes) {
      content += `
        <div class="course-section">
          <h4>Learning Outcomes</h4>
          <ul class="learning-outcomes-list">
            ${Array.isArray(courseInfo.learningOutcomes) ? 
              courseInfo.learningOutcomes.map(outcome => `<li>${outcome}</li>`).join('') : 
              `<li>${courseInfo.learningOutcomes}</li>`}
          </ul>
        </div>
      `;
    }
    
    // Update the container with the content
    containerElem.innerHTML = content;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
    
  } catch (error) {
    console.error('Error loading course description:', error);
    containerElem.innerHTML = `
      <div class="description-error">
        <p>Course description not available at this time.</p>
      </div>
    `;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
  }
}
// Fix the similar courses display in the renderer
// Fix the similar courses display in the renderer
async function loadSimilarCourses(course) {
  const similarTab = document.getElementById('similar-tab');
  const loadingElem = similarTab.querySelector('.similar-courses-loading');
  const containerElem = document.getElementById('similar-courses-container');
  
  if (!course || !course.courseDesignation) {
    containerElem.innerHTML = `
      <div class="similar-error">
        <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h3>No Course Information</h3>
        <p>Course information is not available to find similar courses.</p>
      </div>
    `;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
    return;
  }
  
  try {
    loadingElem.style.display = 'block';
    containerElem.style.display = 'none';
    // Parse the course designation to get subject and number
    const designationParts = course.courseDesignation.split(' ');
    if (designationParts.length < 2) {
      throw new Error('Invalid course designation format');
    }
    
    // Extract the subject and course number
    const subject = designationParts.length > 2 ? 
      designationParts.slice(0, -1).join(' ') : 
      designationParts[0];
    
    const courseNumber = designationParts[designationParts.length - 1];
    
    // Fetch similar courses based on the course code
    const similarCourses = await window.electronAPI.fetchSimilarCourses(
      subject,
      course.courseId,
    );
    
    console.log("Received similar courses:", similarCourses);
    
    // If no similar courses found
    if (!similarCourses || similarCourses.length === 0) {
      containerElem.innerHTML = `
        <div class="similar-empty">
          <div class="empty-icon"><i class="fas fa-search"></i></div>
          <h3>No Similar Courses Found</h3>
          <p>We couldn't find any similar courses that are currently available.</p>
          <p>Consider joining the waitlist or checking back later.</p>
        </div>
      `;
      loadingElem.style.display = 'none';
      containerElem.style.display = 'block';
      return;
    }
    
    // Generate HTML for similar courses
    let content = `
      <div class="similar-courses-wrapper">
        <div class="similar-header">
          <h3>Alternative Course Options</h3>
          <p>Here are some similar courses to <strong>${course.courseDesignation}</strong> that may fulfill your requirements:</p>
        </div>
        
        <div class="similar-courses-list">
    `;
    
    // Add each similar course
    similarCourses.forEach(similarCourse => {
      // Determine seat status for styling
      const seatStatus = similarCourse.openSeats > 5 ? 'plenty' : similarCourse.openSeats > 0 ? 'limited' : 'none';
      
      // Build the course card with enhanced information
      content += `
        <div class="similar-course-card">
          <div class="similar-course-header">
            <h4>${similarCourse.subject} ${similarCourse.courseNumber}: ${similarCourse.title}</h4>
            <span class="status-${similarCourse.status.toLowerCase()}">${similarCourse.status}</span>
          </div>
          
          <div class="similar-course-body">
            <div class="similar-course-info">
              <p><i class="fas fa-user-friends"></i> <strong>Section:</strong> ${similarCourse.section}</p>
              <p><i class="fas fa-clock"></i> <strong>Meeting Times:</strong> ${similarCourse.meetingTimes}</p>
              <p><i class="fas fa-map-marker-alt"></i> <strong>Location:</strong> ${similarCourse.location}</p>
              <p><i class="fas fa-chalkboard-teacher"></i> <strong>Instructor:</strong> ${similarCourse.instructor}</p>
              <p><i class="fas fa-graduation-cap"></i> <strong>Mode:</strong> ${similarCourse.instructionMode}</p>
            </div>
            
            <div class="similar-course-seats">
              <div class="seats-container">
                <div class="seats-header">Available Seats</div>
                <div class="seats-count ${seatStatus}">${similarCourse.openSeats}/${similarCourse.enrollmentCapacity}</div>
                <div class="seats-progress">
                  <div class="seats-filled" style="width: ${similarCourse.enrollmentCapacity > 0 ? 
                    (Math.min((similarCourse.enrolled / similarCourse.enrollmentCapacity), 1) * 100) : 100}%;"></div>
                </div>
                ${similarCourse.waitlist > 0 ? `
                <div class="waitlist-info">
                  <span class="waitlist-count">${similarCourse.waitlist}/${similarCourse.waitlistCapacity}</span> on waitlist
                </div>
                ` : ''}
              </div>
            </div>
          </div>
          
          <div class="similar-course-actions">
            <button class="btn-add-course" data-course-id="${similarCourse.id}">
              <i class="fas fa-plus-circle"></i> Add to Watchlist
            </button>
            <a href="https://public.enroll.wisc.edu/search?term=${course.termCode}&keywords=${similarCourse.subject}%20${similarCourse.courseNumber}" 
              target="_blank" class="btn-view-details">
              <i class="fas fa-external-link-alt"></i> View in Course Search
            </a>
          </div>
        </div>
      `;
    });
    
    content += `
        </div>
        
        <div class="similar-footer">
          <p><small>These recommendations are based on courses in the same subject area and level.</small></p>
        </div>
      </div>
    `;
    
    // Update the container with the content
    containerElem.innerHTML = content;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
    
    // Add event listeners to "Add to Watchlist" buttons
    const addButtons = containerElem.querySelectorAll('.btn-add-course');
    addButtons.forEach(button => {
      button.addEventListener('click', async function() {
        const courseId = this.getAttribute('data-course-id');
        const similarCourse = similarCourses.find(c => c.id === courseId);
        
        if (similarCourse) {
          // Create a course object in the format expected by addCourse
          const courseToAdd = {
            courseId: similarCourse.id,
            termCode: course.termCode,
            title: similarCourse.title,
            courseDesignation: `${similarCourse.subject} ${similarCourse.courseNumber}`,
            subject: {
              subjectCode: course.subjectCode
            }
          };
          
          // Add the course to the watchlist
          await addCourse(courseToAdd);
          
          // Change the button to indicate it was added
          this.innerHTML = '<i class="fas fa-check"></i> Added to Watchlist';
          this.disabled = true;
          this.classList.add('added');
        }
      });
    });
    
  } catch (error) {
    console.error('Error loading similar courses:', error);
    containerElem.innerHTML = `
      <div class="similar-error">
        <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h3>Error Finding Similar Courses</h3>
        <p>There was a problem retrieving similar course options: ${error.message}</p>
      </div>
    `;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
  }
}

// NEW FEATURE: Load textbook information
async function loadTextbookInfo(course) {
  const textbooksTab = document.getElementById('textbooks-tab');
  const loadingElem = textbooksTab.querySelector('.textbooks-loading');
  const containerElem = document.getElementById('textbooks-container');
  
  if (!course || !course.courseDesignation) {
    containerElem.innerHTML = `
      <div class="textbooks-error">
        <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h3>No Course Information</h3>
        <p>Course information is not available to fetch textbook details.</p>
      </div>
    `;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
    return;
  }
  
  try {
    loadingElem.style.display = 'block';
    containerElem.style.display = 'none';
    
    // Parse course designation to get subject and number
    const designationParts = course.courseDesignation.split(' ');
    if (designationParts.length < 2) {
      throw new Error('Invalid course designation format');
    }
    
    // Extract the subject and course number
    const subject = designationParts.length > 2 ? 
      designationParts.slice(0, -1).join(' ') : 
      designationParts[0];
    
    const courseNumber = designationParts[designationParts.length - 1];
    
    // Fetch textbook information
    const textbookData = await window.electronAPI.fetchTextbookInfo(
      { code: course.termCode }, 
      course.subjectCode,
      courseNumber,
      course
    );
    
    if (!textbookData || !textbookData.hasTextbooks) {
      containerElem.innerHTML = `
        <div class="textbooks-empty">
          <div class="empty-icon"><i class="fas fa-book"></i></div>
          <h3>No Textbooks Found</h3>
          <p>No textbook information is currently available for this course.</p>
          <p>You can check the <a href="https://www.uwbookstore.com/textbook-search" target="_blank" class="bookstore-link">UW Bookstore</a> for the most up-to-date information.</p>
        </div>
      `;
      loadingElem.style.display = 'none';
      containerElem.style.display = 'block';
      return;
    }
    
    // Generate HTML content for textbooks
    let content = `
      <h3>Required Materials for ${course.courseDesignation}</h3>
      ${textbookData.sectionNotes ? 
        `<p class="section-notes">${textbookData.sectionNotes}</p>` : ''}
      <div class="textbooks-list">
    `;
    
    if (textbookData.textbooks && textbookData.textbooks.length > 0) {
      textbookData.textbooks.forEach(book => {
        content += `
          <div class="textbook-item ${book.required ? 'required' : 'optional'}">
            <div class="textbook-cover">
              ${book.coverImage ? 
                `<img src="${book.coverImage}" alt="Book cover" class="book-cover" onerror="this.src='https://placehold.co/100x160?text=No+Cover'">` : 
                `<div class="no-cover">No Cover Available</div>`
              }
              <div class="book-tag">${book.required ? 'Required' : 'Optional'}</div>
            </div>
            <div class="textbook-details">
              <h4 class="book-title">${book.title}</h4>
              <p class="book-author">By ${book.author || 'Various'}</p>
              ${book.isbn ? `<p class="book-isbn">ISBN: ${book.isbn}</p>` : ''}
              ${book.publisher ? `<p class="book-publisher">Publisher: ${book.publisher}</p>` : ''}
              ${book.year ? `<p class="book-year">Year: ${book.year}</p>` : ''}
              ${book.edition ? `<p class="book-edition">Edition: ${book.edition}</p>` : ''}
              ${book.notes ? `<p class="book-notes">${book.notes}</p>` : ''}
              
              ${book.isbn ? `
                <div class="book-actions">
                  <a href="https://www.amazon.com/dp/${book.isbn}" target="_blank" class="book-action amazon">
                    <i class="fab fa-amazon"></i> View on Amazon
                  </a>
                  <a href="https://www.chegg.com/search?q=${book.isbn}" target="_blank" class="book-action chegg">
                    Chegg
                  </a>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });
    }
    
    if (textbookData.otherMaterials && textbookData.otherMaterials.length > 0) {
      content += `<div class="other-materials"><h4>Other Materials</h4>`;
      
      textbookData.otherMaterials.forEach(material => {
        let descriptionText = material.description;
        
        // Check if the description is a URL
        if (descriptionText && descriptionText.match(/^https?:\/\//)) {
          descriptionText = `<a href="${descriptionText}" target="_blank">${descriptionText}</a>`;
        }
        
        content += `
          <div class="material-item ${material.required ? 'required' : 'optional'}">
            <div class="material-tag">${material.required ? 'Required' : 'Optional'}</div>
            <div class="material-description">${descriptionText}</div>
            ${material.notes ? `<div class="material-notes">${material.notes}</div>` : ''}
          </div>
        `;
      });
      
      content += `</div>`;
    }
    
    content += `
      </div>
      <div class="textbook-footer">
        <a href="${textbookData.bookstoreLink}" target="_blank" class="bookstore-btn">
          <i class="fas fa-external-link-alt"></i> View at UW Bookstore
        </a>
        <p class="textbook-note">Prices and availability subject to change.</p>
      </div>
    `;
    
    // Update the container with the content
    containerElem.innerHTML = content;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
    
  } catch (error) {
    console.error('Error loading textbook information:', error);
    containerElem.innerHTML = `
      <div class="textbooks-error">
        <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h3>Error Loading Textbook Information</h3>
        <p>There was a problem retrieving textbook data: ${error.message}</p>
      </div>
    `;
    loadingElem.style.display = 'none';
    containerElem.style.display = 'block';
  }
}