/* tests.js */
(function() {
  const runTestsButton = document.getElementById('run-tests');
  let testResultsAvailable = false;
  let lastTestResults = null;

  runTestsButton.addEventListener('click', async () => {
    if (testResultsAvailable) {
      // If tests have been run, show results in modal instead of running again
      showTestResults();
      return;
    }

    runTestsButton.disabled = true;
    // Updated button text during test run
    const loadingMessages = [
      'Running tests...',
      'Preparing test suite...',
      'Almost done...',
      'Awaiting response...'
    ];
    let currentMessageIndex = 0;
    let dotCount = 0;
    
    const intervalId = setInterval(() => {
      const message = loadingMessages[currentMessageIndex];
      const dots = '.'.repeat(dotCount % 4);
      runTestsButton.innerHTML = `<span class="emoji">⏳</span> ${message}${dots}`;
      dotCount++;
      if (dotCount % 5 === 0) {
        currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
      }
    }, 500);

    try {
      const response = await fetch('/run_tests', { method: 'POST' });
      const result = await response.json();
      
      // Store test results for modal display
      lastTestResults = result;
      testResultsAvailable = true;
      
      clearInterval(intervalId);
      // Update button text to indicate test results are available, preventing re-run.
      runTestsButton.innerHTML = '<span class="emoji">🧪</span> Test Results';
      runTestsButton.disabled = false;
      runTestsButton.classList.add('has-results');
      
      // Show a notification that tests are complete
      const notificationElement = document.createElement('div');
      notificationElement.className = result.status === 'ok' ? 'notification success' : 'notification warning';
      notificationElement.innerHTML = `<span class="emoji">${result.status === 'ok' ? '✅' : '⚠️'}</span> ${
        result.status === 'ok' ? 'Tests completed successfully!' : 'Tests completed with warnings.'
      }`;
      document.querySelector('.logs-container').appendChild(notificationElement);
      
      setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => notificationElement.remove(), 500);
      }, 5000);
      
      if (window.fetchLogs) {
        window.fetchLogs();
      }
      
      // Automatically show test results modal
      showTestResults();
    } catch (err) {
      console.error('Error running tests', err);
      clearInterval(intervalId);
      runTestsButton.innerHTML = '<span class="emoji">🧪</span> Run Tests';
      runTestsButton.disabled = false;
      
      const errorNotification = document.createElement('div');
      errorNotification.className = 'notification error';
      errorNotification.innerHTML = `<span class="emoji">❌</span> Error running tests`;
      document.querySelector('.logs-container').appendChild(errorNotification);
      
      setTimeout(() => {
        errorNotification.style.opacity = '0';
        setTimeout(() => errorNotification.remove(), 500);
      }, 5000);
    }
  });

  function showTestResults() {
    // Set modal title for test results
    const modalTitle = document.querySelector('.modal-title');
    modalTitle.innerHTML = '<span class="emoji">🧪</span> Test Results';
    
    // Create a dedicated test results tab if it doesn't exist
    if (!document.querySelector('[data-tab="test-results"]')) {
      const tabsContainer = document.querySelector('.modal-tabs');
      const newTab = document.createElement('div');
      newTab.className = 'modal-tab';
      newTab.setAttribute('data-tab', 'test-results');
      newTab.textContent = '🧪 Test Results';
      newTab.onclick = function() { switchTab('test-results'); };
      tabsContainer.appendChild(newTab);
      
      // Create the content container
      const modalBody = document.querySelector('.modal-body');
      const resultsContent = document.createElement('div');
      resultsContent.id = 'test-results-content';
      resultsContent.className = 'tab-content';
      modalBody.appendChild(resultsContent);
    }
    
    // Populate the test results content
    const resultsContent = document.getElementById('test-results-content');
    
    if (lastTestResults) {
      let statusClass = lastTestResults.status === 'ok' ? 'success' : 'warning';
      let statusEmoji = lastTestResults.status === 'ok' ? '✅' : '⚠️';
      
      resultsContent.innerHTML = `
        <div class="test-results-header ${statusClass}">
          <span class="emoji">${statusEmoji}</span>
          <span>Test Status: ${lastTestResults.status === 'ok' ? 'Success' : 'Warning'}</span>
        </div>
        <div class="test-results-body">
          <pre>${lastTestResults.message.replace(/\n/g, '<br>')}</pre>
        </div>
      `;
    } else {
      resultsContent.innerHTML = `
        <div class="test-results-empty">
          <p>No test results available. Please run tests first.</p>
        </div>
      `;
    }
    
    // Show the modal and switch to the test results tab
    window.openModal('test-results');
  }
  
  // Override switchTab to preserve modal.js functionality while ensuring test-results loads correctly.
  const originalSwitchTab = window.switchTab;
  window.switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'test-results') {
      const resultsContent = document.getElementById('test-results-content');
      if (resultsContent && resultsContent.innerHTML.trim() === '') {
         resultsContent.innerHTML = `
           <div class="test-results-empty">
             <p>No test results available. Please run tests first.</p>
           </div>
         `;
      }
    }
  };

  const clearLogsButton = document.getElementById('clear-logs');
  clearLogsButton.innerHTML = '<span class="emoji">🧹</span>';
  clearLogsButton.title = "Clear Logs";

  clearLogsButton.addEventListener('click', async () => {
    clearLogsButton.disabled = true;
    clearLogsButton.innerHTML = '<span class="emoji">⏳</span>';
    
    try {
      const response = await fetch('/clear_logs', { method: 'POST' });
      const result = await response.json();
      
      const notificationElement = document.createElement('div');
      notificationElement.className = 'notification success';
      notificationElement.innerHTML = `<span class="emoji">🧹</span> Logs cleared successfully!`;
      document.querySelector('.logs-container').appendChild(notificationElement);
      
      setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => notificationElement.remove(), 500);
      }, 3000);
      
      // Reset test state when logs are cleared
      testResultsAvailable = false;
      lastTestResults = null;
      runTestsButton.innerHTML = '<span class="emoji">🧪</span> Run Tests';
      runTestsButton.classList.remove('has-results');
      
      // Keep the broom (sweep) emoji hidden for a little longer (2 seconds)
      setTimeout(() => {
        clearLogsButton.innerHTML = '<span class="emoji">🧹</span>';
        clearLogsButton.disabled = false;
        if (window.fetchLogs) {
          window.fetchLogs();
        }
      }, 2000);
    } catch (err) {
      console.error('Error clearing logs', err);
      clearLogsButton.innerHTML = '<span class="emoji">🧹</span>';
      clearLogsButton.disabled = false;
      
      const errorNotification = document.createElement('div');
      errorNotification.className = 'notification error';
      errorNotification.innerHTML = `<span class="emoji">❌</span> Error clearing logs`;
      document.querySelector('.logs-container').appendChild(errorNotification);
      
      setTimeout(() => {
        errorNotification.style.opacity = '0';
        setTimeout(() => errorNotification.remove(), 500);
      }, 3000);
    }
  });
  
  // Additional styles for test results
  const style = document.createElement('style');
  style.textContent = `
    .test-results-header {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-weight: 500;
      display: flex;
      align-items: center;
    }
    
    .test-results-header.success {
      background-color: rgba(67, 160, 71, 0.2);
      color: #2E7D32;
    }
    
    .test-results-header.warning {
      background-color: rgba(251, 140, 0, 0.2);
      color: #E65100;
    }
    
    .test-results-header .emoji {
      margin-right: 10px;
      font-size: 1.2em;
    }
    
    .test-results-body {
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 15px;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .test-results-body pre {
      margin: 0;
      white-space: pre-wrap;
      font-family: monospace;
    }
  `;
  document.head.appendChild(style);
})();
