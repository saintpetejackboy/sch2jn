// Toggle configuration modal
let currentTab = 'config';

function openModal(tabName) {
  const modal = document.getElementById('modal');
  
  // Set active tab
  currentTab = tabName;
  updateActiveTabs();
  
  // Display modal with animation
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  
  // Load content based on tab
  if (tabName === 'config') {
    fetchConfig();
  } else if (tabName === 'readme') {
    fetchReadme();
  }
}

function closeModal() {
  const modal = document.getElementById('modal');
  
  // Add closing animation and then hide
  const modalContent = document.querySelector('.modal-content');
  modalContent.style.animation = 'modalOut 0.2s ease-in forwards';
  
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    modalContent.style.animation = 'modalIn 0.3s ease-out';
    
    // Clear content
    document.querySelectorAll('.tab-content').forEach(tab => {
      if (!tab.classList.contains('active')) {
        tab.innerHTML = '';
      }
    });
  }, 200);
}

function switchTab(tabName) {
  currentTab = tabName;
  updateActiveTabs();
  
  // Load content if needed
  if (tabName === 'config' && document.getElementById('config-content').innerHTML.trim() === '') {
    fetchConfig();
  } else if (tabName === 'readme' && document.getElementById('readme-content').innerHTML.trim() === '') {
    fetchReadme();
  }
}

function updateActiveTabs() {
  // Update tab highlighting
  document.querySelectorAll('.modal-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === currentTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Show active content
  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `${currentTab}-content`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Update modal title
  const modalTitle = document.querySelector('.modal-title');
  if (currentTab === 'config') {
    modalTitle.innerHTML = '<span class="emoji">⚙️</span> Configuration';
  } else if (currentTab === 'readme') {
    modalTitle.innerHTML = '<span class="emoji">📚</span> Documentation';
  }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
  const modal = document.getElementById('modal');
  if (event.target === modal) {
    closeModal();
  }
}

// Fetch configuration data
async function fetchConfig() {
  try {
    const configContent = document.getElementById('config-content');
    configContent.innerHTML = '<div style="text-align: center; padding: 20px;">Loading configuration...</div>';
    
    const response = await fetch('/config');
    const config = await response.json();
    
    let html = `
      <div class="required-notice">
        <strong>Note:</strong> <span class="highlight">JOB_NIMBUS_API_KEY</span> is required for this application to function.
      </div>
      <table id="config-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Description</th>
            <th>Type</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Add rows
    config.forEach(item => {
      const isRequired = item.key === 'JOB_NIMBUS_API_KEY';
      const rowStyle = isRequired ? 'style="background-color: rgba(255, 100, 100, 0.1);"' : '';
      
      html += `
        <tr ${rowStyle}>
          <td>${item.key}</td>
          <td>${item.value}</td>
          <td>${item.description}</td>
          <td>${item.type}</td>
          <td>${isRequired ? '<span class="highlight">Yes</span>' : 'No'}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    configContent.innerHTML = html;
  } catch (err) {
    console.error('Error fetching configuration:', err);
    document.getElementById('config-content').innerHTML = '<p>Error fetching configuration</p>';
  }
}

// Fetch README content
async function fetchReadme() {
  try {
    const readmeContent = document.getElementById('readme-content');
    readmeContent.innerHTML = '<div style="text-align: center; padding: 20px;">Loading documentation...</div>';
    
    const response = await fetch('/static/README.md');
    const text = await response.text();
    
    // Simple markdown to HTML conversion (for basic formatting)
    let html = '<div class="markdown-content">';
    
    const lines = text.split('\n');
    let inCodeBlock = false;
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          html += '<pre><code>';
          inCodeBlock = true;
        } else {
          html += '</code></pre>';
          inCodeBlock = false;
        }
        continue;
      }
      
      if (inCodeBlock) {
        html += line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
        continue;
      }
      
      // Headers
      if (line.startsWith('# ')) {
        html += `<h1>${line.substring(2)}</h1>`;
      } else if (line.startsWith('## ')) {
        html += `<h2>${line.substring(3)}</h2>`;
      } else if (line.startsWith('### ')) {
        html += `<h3>${line.substring(4)}</h3>`;
      }
      // Lists
      else if (line.trim().match(/^[*-] /)) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${line.trim().substring(2)}</li>`;
      }
      // End of list
      else if (inList && line.trim() === '') {
        html += '</ul>';
        inList = false;
        html += '<p></p>';
      }
      // Normal paragraph
      else if (line.trim() !== '') {
        // Inline code
        const formattedLine = line.replace(/`([^`]+)`/g, '<code>$1</code>');
        html += `<p>${formattedLine}</p>`;
      }
      else {
        html += '<br>';
      }
    }
    
    if (inList) {
      html += '</ul>';
    }
    
    html += '</div>';
    readmeContent.innerHTML = html;
  } catch (err) {
    console.error('Error fetching README:', err);
    document.getElementById('readme-content').innerHTML = '<p>Error loading documentation. Please check the GitHub repository.</p>';
  }
}

// Map of problematic emoji patterns to their correct replacements
const emojiReplacements = {
  // Starting/server emojis
  '🚀': '🚀', 
  
  // Status emojis
  '✅': '✅', 
  '❌': '❌', 
  '⚠️': '⚠️',
  
  // Action emojis
  '🧪': '🧪',
  '🧹': '🧹',
  
  // Common broken patterns for rocket emoji
  '\\uD83D\\uDE80': '🚀',
  '\\\\uD83D\\\\uDE80': '🚀',
  '��': '🚀',
  
  // Common broken patterns for check mark
  '\\uD83D\\uDC4D': '✅',
  '\\\\uD83D\\\\uDC4D': '✅',
  
  // Common broken patterns for broom (clear logs)
  '\\uD83E\\uDDF9': '🧹',
  '\\\\uD83E\\\\uDDF9': '🧹',
  
  // Other emojis
  '📥': '📥', 
  '📤': '📤', 
  '📬': '📬', 
  'ℹ️': 'ℹ️',
  '🔄': '🔄', 
  '🔒': '🔒', 
  '📊': '📊', 
  '📝': '📝'
};

// Enhanced function to fix broken emojis
function fixBrokenEmojis(text) {
  // First try to detect common patterns of broken emojis
  
  // 1. Look for "�� Starting server" pattern and replace it
  text = text.replace(/��\s+Starting server/g, '🚀 Starting server');
  
  // 2. Look for "�� Logs cleared" pattern and replace it
  text = text.replace(/��\s+Logs cleared/g, '🧹 Logs cleared');
  
  // 3. For other broken patterns, use a more generic replacement
  for (const [pattern, replacement] of Object.entries(emojiReplacements)) {
    // Create a case-insensitive global regex for each pattern
    // Use pattern.replace() to escape special regex characters
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    text = text.replace(regex, replacement);
  }
  
  // 4. Final cleanup for any remaining broken characters
  text = text.replace(/�/g, '');
  
  return text;
}

// Convert ISO timestamp to human-readable EST format
function formatTimestamp(isoTimestamp) {
  try {
    const date = new Date(isoTimestamp);
    
    // Format to EST timezone (UTC-5)
    const options = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    };
    
    return date.toLocaleString('en-US', options) + ' EST';
  } catch (e) {
    // If there's any error parsing the timestamp, return it as is
    return isoTimestamp;
  }
}

// Color HTTP status codes based on their class
function colorizeStatusCodes(text) {
  // 2xx status codes (Success)
  text = text.replace(/(\s|HTTP\s+)(2\d{2})(\s|[,.])/g, '$1<span class="status-2xx">$2</span>$3');
  
  // 3xx status codes (Redirection)
  text = text.replace(/(\s|HTTP\s+)(3\d{2})(\s|[,.])/g, '$1<span class="status-3xx">$2</span>$3');
  
  // 4xx status codes (Client Error)
  text = text.replace(/(\s|HTTP\s+)(4\d{2})(\s|[,.])/g, '$1<span class="status-4xx">$2</span>$3');
  
  // 5xx status codes (Server Error)
  text = text.replace(/(\s|HTTP\s+)(5\d{2})(\s|[,.])/g, '$1<span class="status-5xx">$2</span>$3');
  
  return text;
}

// Colorize numeric values
function colorizeNumbers(text) {
  // Look for numbers, but avoid matching inside HTML tags or class names
  // This regex looks for numbers not inside < > brackets and not after class=
  text = text.replace(/(?<![<>a-zA-Z]class="|[<>])(\d+)(?![^<>]*>)/g, '<span class="number">$1</span>');
  
  return text;
}

function formatLogEntry(text) {
  // Fix broken emojis first
  text = fixBrokenEmojis(text);
  
  // Find and format timestamps
  text = text.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.+-]\d+)/g, function(match) {
    return '<span class="timestamp">' + formatTimestamp(match) + '</span>';
  });
  
  // Add classes for different types of logs based on emoji
  text = text.replace(/([^<])(✅|🆗|✓)(.+?)(<br>|$)/g, '$1<span class="log-success">$2$3</span>$4');
  text = text.replace(/([^<])(❌|🛑|✗)(.+?)(<br>|$)/g, '$1<span class="log-error">$2$3</span>$4');
  text = text.replace(/([^<])(⚠️|🔶)(.+?)(<br>|$)/g, '$1<span class="log-warning">$2$3</span>$4');
  text = text.replace(/([^<])(🧪|🔬)(.+?)(<br>|$)/g, '$1<span class="log-test">$2$3</span>$4');
  text = text.replace(/([^<])(📥|📤|📬|ℹ️|🧹|🔄|🔒)(.+?)(<br>|$)/g, '$1<span class="log-normal">$2$3</span>$4');
  
  // Make emojis stand out
  text = text.replace(/([🚀✅❌⚠️🧪🔶🛑🆗🔬✓✗🔄🔒📊📝📥📤📬ℹ️🧹])/g, '<span class="emoji">$1</span>');
  
  // Colorize HTTP status codes
  text = colorizeStatusCodes(text);
  
  // Colorize numbers
  text = colorizeNumbers(text);
  
  // Improve compiler output formatting
  if (text.includes('Compiling') || text.includes('Finished')) {
    // Collapse compiler output into a cleaner format
    const lines = text.split('<br>');
    const compilingLines = [];
    const otherLines = [];
    
    for (const line of lines) {
      if (
        line.includes('Compiling') || 
        line.includes('Finished') || 
        line.includes('Running') && !line.includes('Running tests') ||
        line.includes('target/') ||
        line.includes('warning: ') ||
        line.includes('file=')
      ) {
        compilingLines.push(line);
      } else {
        otherLines.push(line);
      }
    }
    
    if (compilingLines.length > 0) {
      let formattedText = '<details><summary>Compiler Output (click to expand)</summary>';
      formattedText += compilingLines.join('<br>');
      formattedText += '</details>';
      formattedText += otherLines.join('<br>');
      return formattedText;
    }
  }
  
  // Format test results
  text = text.replace(/running \d+ tests/g, '<strong class="log-test">$&</strong>');
  text = text.replace(/(test .+? \.\.\. )(ok)/g, '$1<span class="log-success">$2</span>');
  text = text.replace(/(test .+? \.\.\. )(FAILED)/g, '$1<span class="log-error">$2</span>');
  text = text.replace(/test result: (FAILED)/g, 'test result: <span class="log-error">$1</span>');
  text = text.replace(/test result: (ok)/g, 'test result: <span class="log-success">$1</span>');
  text = text.replace(/(panicked at)/g, '<span class="log-error">$1</span>');
  
  // Format error messages more clearly
  text = text.replace(/(Error|Failed|FAILED|error:)([^<]+)(<br>|$)/gi, '<span class="log-error">$1$2</span>$3');
  
  return text;
}

// Fetch logs with proper emoji handling
async function fetchLogs() {
  try {
    const response = await fetch('/logs');
    // Directly use text() to avoid encoding issues
    let text = await response.text();
    
    // Format the log text
    text = formatLogEntry(text.replace(/\n/g, '<br>'));
    
    document.getElementById('logs').innerHTML = text;
    
    // Auto-scroll to bottom
    const logsDiv = document.getElementById('logs');
    logsDiv.scrollTop = logsDiv.scrollHeight;
  } catch (err) {
    console.error('Error fetching logs:', err);
    document.getElementById('logs').textContent = 'Error fetching logs';
  }
}

// Handle button events
document.addEventListener('DOMContentLoaded', function() {
  // Run tests button
  document.getElementById('run-tests').addEventListener('click', async () => {
    try {
      const button = document.getElementById('run-tests');
      button.innerHTML = '<span class="emoji">⏳</span> Running...';
      button.disabled = true;
      
      const response = await fetch('/run_tests', { method: 'POST' });
      const result = await response.json();
      console.log(result);
      
      setTimeout(() => {
        button.innerHTML = '<span class="emoji">🧪</span> Run Tests';
        button.disabled = false;
        fetchLogs();
      }, 1000);
    } catch (err) {
      console.error('Error running tests', err);
      const button = document.getElementById('run-tests');
      button.innerHTML = '<span class="emoji">🧪</span> Run Tests';
      button.disabled = false;
    }
  });

  // Clear logs button
  document.getElementById('clear-logs').addEventListener('click', async () => {
    try {
      const button = document.getElementById('clear-logs');
      button.innerHTML = '<span class="emoji">⏳</span> Clearing...';
      button.disabled = true;
      
      const response = await fetch('/clear_logs', { method: 'POST' });
      const result = await response.json();
      console.log(result);
      
      setTimeout(() => {
        button.innerHTML = '<span class="emoji">🧹</span> Clear Logs';
        button.disabled = false;
        fetchLogs();
      }, 500);
    } catch (err) {
      console.error('Error clearing logs', err);
      const button = document.getElementById('clear-logs');
      button.innerHTML = '<span class="emoji">🧹</span> Clear Logs';
      button.disabled = false;
    }
  });

  // GitHub link
  document.getElementById('github-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://github.com/saintpetejackboy/sch2jn', '_blank');
  });

  // Initial data load
  fetchLogs();
  
  // Update logs every 5 seconds
  setInterval(fetchLogs, 5000);
  
  // Set up animation background
  if (!document.querySelector('.bg-animation')) {
    const bgAnimation = document.createElement('div');
    bgAnimation.className = 'bg-animation';
    document.body.appendChild(bgAnimation);
  }
});