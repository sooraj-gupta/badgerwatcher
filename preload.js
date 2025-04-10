const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // Term management
    getTermOptions: () => ipcRenderer.invoke('get-term-options'),
    getTerm: () => ipcRenderer.invoke('get-term'),
    setTerm: (term) => ipcRenderer.invoke('set-term', term),
    
    // Course search and management
    searchCourses: (query) => ipcRenderer.invoke('search-courses', query),
    addCourse: (course) => ipcRenderer.invoke('add-course', course),
    removeCourse: (courseId) => ipcRenderer.invoke('remove-course', courseId),
    getCourseData: (courseId) => ipcRenderer.invoke('get-course-data', courseId),
    onAddWatchedCourse: (callback) => {
      ipcRenderer.on('add-watched-course', callback);
    },
    
    // MadGrades integration
    searchCourseUUID: (courseDesignation) => ipcRenderer.invoke('search-course-uuid', courseDesignation),
    fetchCourseGrades: (uuid) => ipcRenderer.invoke('fetch-course-grades', uuid),
    
    // Settings management
    openSettings: () => ipcRenderer.invoke('open-settings'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    onApiLiveStatus: (callback) => {
      ipcRenderer.on('api-live-status', (event, status) => callback(status));
    },
    sendTestMessage: (phoneNumber) => ipcRenderer.invoke('send-test-message', phoneNumber),
    
    // Course updates 
    onCourseUpdate: (callback) => {
      // Fixed: Ensure data is passed correctly to the callback
      ipcRenderer.on('course-update', (event, data) => callback(event, data));
    },    
    onLoadCourse: (callback) => ipcRenderer.on('course-load', (_, courseId) => callback(courseId)),
    
    // NEW FEATURE APIs
    fetchCourseSyllabus: (courseId) => ipcRenderer.invoke('fetch-course-syllabus', courseId),
    fetchSimilarCourses: (subjectCode, currentCourseId) => ipcRenderer.invoke('fetch-similar-courses', subjectCode, currentCourseId),
    fetchTextbookInfo: (term, subjectCode, courseNumber, course) => ipcRenderer.invoke('fetch-textbook-info', term, subjectCode, courseNumber, course)
  }
);