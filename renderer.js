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

  window.electronAPI.loadCourse((event, courseId) => {
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
  
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'course-detail-modal';
  modal.innerHTML = `
    <div class="course-detail-content">
      <div class="course-detail-header">
        <h2>${course.courseDesignation}: ${course.title}</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="course-detail-tabs">
        <button class="tab-btn active" data-tab="info">Course Info</button>
        <button class="tab-btn" data-tab="grades">Grade Distribution</button>
      </div>
      <div class="course-detail-body">
        <div id="info-tab" class="tab-content active">
          <p><strong>Course ID:</strong> ${courseId}</p>
          <p><strong>Status:</strong> <span id="modal-course-status">Loading...</span></p>
          <!-- Add more course info here -->
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
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
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
      
      if (btn.dataset.tab === 'grades' && !modal.querySelector('#grades-chart').hasAttribute('data-loaded')) {
        loadGradeData(course.courseDesignation);
      }
    });
  });
  
  // Update the course status in the modal
  updateModalCourseStatus(courseId);
}

// Function to load and render grade data
async function loadGradeData(courseDesignation) {
  const gradesTab = document.querySelector('#grades-tab');
  const loadingEl = gradesTab.querySelector('.grades-loading');
  const containerEl = gradesTab.querySelector('.grades-container');
  
  try {
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    
    // First get the course UUID
    const courseUuid = await window.electronAPI.searchCourseUuid(courseDesignation);
    
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

// Function to render grade chart using Chart.js
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
  
  // Create and configure the chart
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['A', 'AB', 'B', 'BC', 'C', 'D', 'F'],
      datasets: [{
        label: 'Grade Distribution',
        data: percentages,
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',  // A - teal
          'rgba(75, 192, 150, 0.8)',  // AB - lighter teal
          'rgba(54, 162, 235, 0.8)',  // B - blue
          'rgba(54, 120, 235, 0.8)',  // BC - darker blue
          'rgba(255, 206, 86, 0.8)',  // C - yellow
          'rgba(255, 159, 64, 0.8)',  // D - orange
          'rgba(255, 99, 132, 0.8)'   // F - red
        ],
        borderWidth: 1
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
            text: 'Percentage'
          },
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const count = counts[index];
              return `${context.raw}% (${count} students)`;
            }
          }
        },
        legend: {
          display: false // Hide the legend since we use a single dataset
        },
        title: {
          display: true,
          text: 'Grade Distribution',
          font: {
            size: 16
          }
        }
      }
    }
  });
  
  // Also display the raw data below the chart for clarity
  const chartContainer = document.querySelector('.grades-container');
  const dataTable = chartContainer.querySelector('.grade-data-table');
  dataTable.innerHTML = `
    <table style="width: 100%; margin-top: 10px; font-size: 0.8em; text-align: center;">
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
        <td>%</td>
        ${percentages.map(p => `<td>${p}%</td>`).join('')}
      </tr>
      <tr>
        <td>Count</td>
        ${counts.map(c => `<td>${c}</td>`).join('')}
      </tr>
    </table>
  `;
  // chartContainer.appendChild(dataTable);
}

// Function to render grade statistics
// Function to render grade statistics
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
  
  gradeStatItems.style.width = '100%';
  gradeStatItems.style.display = 'flex';
  gradeStatItems.style.gap = '5px';
  

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
function updateModalCourseStatus(courseId) {
  const statusEl = document.getElementById(`status-${courseId}`);
  const modalStatusEl = document.getElementById('modal-course-status');
  
  if (!statusEl || !modalStatusEl) return;
  
  // Copy the status from the main UI to the modal
  const statusText = statusEl.textContent || statusEl.innerText;
  modalStatusEl.textContent = statusText;
  
  // Copy the status class
  modalStatusEl.className = '';
  if (statusEl.classList.contains('status-open')) {
    modalStatusEl.classList.add('modal-status-open');
  } else if (statusEl.classList.contains('status-waitlisted')) {
    modalStatusEl.classList.add('modal-status-waitlisted');
  } else if (statusEl.classList.contains('status-closed')) {
    modalStatusEl.classList.add('modal-status-closed');
  }
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

// Make sure to add this to your global window object
window.updateModalCourseStatus = updateModalCourseStatus;

// Make viewCourseDetails globally accessible
window.viewCourseDetails = viewCourseDetails;

// Make functions available globally
window.openSettingsWindow = openSettingsWindow;