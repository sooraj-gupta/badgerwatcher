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
      <button class="remove-btn" onclick="removeCourse('${courseId}')">
        <i class="fas fa-trash"></i>
      </button>
    </span>
  `;
  
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

// Make functions available globally
window.openSettingsWindow = openSettingsWindow;