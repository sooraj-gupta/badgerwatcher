const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, 'app-config.json');
    this.defaultConfig = {
      term: {
        code: '1262',
        name: 'Fall 2025'
      },
      phoneNumbers: [],
      watchedCourses: {}
    };
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
      // Create default config if it doesn't exist
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (error) {
      console.error('Error loading config:', error);
      return this.defaultConfig;
    }
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.config = config;
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getConfig() {
    return this.config;
  }

  updateConfig(newConfig) {
    this.saveConfig({ ...this.config, ...newConfig });
    return this.config;
  }

  getTerm() {
    return this.config.term || this.defaultConfig.term;
  }

  setTerm(term) {
    this.config.term = term;
    this.saveConfig(this.config);
    return this.config.term;
  }

  getPhoneNumbers() {
    return this.config.phoneNumbers || this.defaultConfig.phoneNumbers;
  }

  setPhoneNumbers(phoneNumbers) {
    this.config.phoneNumbers = phoneNumbers;
    this.saveConfig(this.config);
    return this.config.phoneNumbers;
  }

  // Methods for watched courses
  getWatchedCourses() {
    return this.config.watchedCourses || {};
  }

  saveWatchedCourse(courseId, courseData) {
    if (!this.config.watchedCourses) {
      this.config.watchedCourses = {};
    }
    this.config.watchedCourses[courseId] = courseData;
    this.saveConfig(this.config);
    return this.config.watchedCourses;
  }

  removeWatchedCourse(courseId) {
    if (this.config.watchedCourses && this.config.watchedCourses[courseId]) {
      delete this.config.watchedCourses[courseId];
      this.saveConfig(this.config);
    }
    return this.config.watchedCourses;
  }
  getMadGradesApiKey() {
    return this.config.madGradesApiKey || 'db0b773feba0467688172d87b38f3f95';
  }
  
  setMadGradesApiKey(apiKey) {
    this.config.madGradesApiKey = apiKey;
    this.saveConfig(this.config);
    return this.config.madGradesApiKey;
  }
}


module.exports = new ConfigManager();