/* main.js */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    if (window.fetchLogs) {
      window.fetchLogs();
      setInterval(window.fetchLogs, 5000);
    }
    
    // Set up background animation if not already present
    if (!document.querySelector('.bg-animation')) {
      const bgAnimation = document.createElement('div');
      bgAnimation.className = 'bg-animation';
      document.body.appendChild(bgAnimation);
    }
  });
})();
