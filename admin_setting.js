// Admin Settings Configuration
// This file allows you to configure all settings for the video reward app

const adminSettings = {
  // Call Settings
  maxCallsPerUser: 10,        // Maximum calls per user (can be increased/decreased)
  callDuration: 30,           // Call duration in seconds
  
  // Reward Settings
  rewardAmount: 10,           // Points per call
  rewardMode: 'random',       // 'random' or 'serial'
  
  // Video Settings
  shuffleVideos: true,        // Shuffle videos randomly
  videoFolder: '/rvideo',     // Video folder path
  
  // Feature Settings
  enableLiveChat: true,       // Enable/disable live chat
  enableVideoCall: true,      // Enable/disable video calls
  enableFakeCall: true,       // Enable/disable fake calls
  
  // UI Settings
  theme: 'dark',              // 'dark' or 'light'
  showRewards: true,          // Show rewards to users
  showCallTimer: true,        // Show call timer
  
  // Advanced Settings
  autoResetVideos: true,      // Auto reset videos when all used
  rewardMultiplier: 1,        // Reward multiplier (1x, 2x, 3x, etc.)
  
  // Chat Settings
  maxMessageLength: 500,      // Maximum characters per message
  chatHistoryLimit: 100,      // Number of messages to keep in history
  enableEmoji: true,          // Enable emoji in chat
  
  // Security Settings
  requireAuth: true,          // Require authentication
  rateLimit: 5,               // Rate limit per minute
  
  // Notification Settings
  enableNotifications: true,  // Enable browser notifications
  soundOnCall: true,          // Play sound on incoming call
  soundOnMessage: true        // Play sound on new message
};

// Export settings
if (typeof module !== 'undefined' && module.exports) {
  module.exports = adminSettings;
}

// For browser usage
if (typeof window !== 'undefined') {
  window.adminSettings = adminSettings;
}
