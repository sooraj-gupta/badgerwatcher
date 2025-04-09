const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  searchCourses: (courseName) => ipcRenderer.invoke('search-courses', courseName),
  addCourse: (course) => ipcRenderer.invoke('add-course', course),
  removeCourse: (courseId) => ipcRenderer.invoke('remove-course', courseId),
  sendTestMessage: (phoneNumber) => ipcRenderer.invoke('send-test-message', phoneNumber),
  onCourseUpdate: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('course-update');
    ipcRenderer.on('course-update', (event, data) => callback(event, data));
    return () => ipcRenderer.removeAllListeners('course-update');
  },
  loadCourse: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('course-load');
    ipcRenderer.on('course-load', (event, courseId) => callback(event, courseId));
    return () => ipcRenderer.removeAllListeners('course-load');
  },
  onAddWatchedCourse: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('add-watched-course');
    ipcRenderer.on('add-watched-course', (event, data) => {
      console.log('Preload: Received add-watched-course event with data:', data);
      callback(event, data);
    });
    return () => ipcRenderer.removeAllListeners('add-watched-course');
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  openSettings: () => ipcRenderer.send('open-settings'),
  getTerm: () => ipcRenderer.invoke('get-term'),
  setTerm: (term) => ipcRenderer.invoke('set-term', term),
  getTermOptions: () => ipcRenderer.invoke('get-term-options'),
  fetchCourseGrades: (courseUuid) => ipcRenderer.invoke('fetch-course-grades', courseUuid),
  searchCourseUuid: (courseDesignation) => ipcRenderer.invoke('search-course-uuid', courseDesignation),
  getCourseData: (courseId) => ipcRenderer.invoke('get-course-data', courseId)
});