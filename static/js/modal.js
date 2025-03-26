/* modal.js */
(function() {
  // Modal-related functions
  let currentTab = 'config';

  window.openModal = function(tabName) {
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
  };

  window.closeModal = function() {
    const modal = document.getElementById('modal');
    
    // Add closing animation and then hide
    const modalContent = document.querySelector('.modal-content');
    modalContent.style.animation = 'modalOut 0.2s ease-in forwards';
    
    setTimeout(() => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
      modalContent.style.animation = 'modalIn 0.3s ease-out';
    }, 200);
  };

  window.switchTab = function(tabName) {
    currentTab = tabName;
    updateActiveTabs();
    
    // Load content if needed
    if (tabName === 'config' && document.getElementById('config-content').innerHTML.trim() === '') {
      fetchConfig();
    } else if (tabName === 'readme' && document.getElementById('readme-content').innerHTML.trim() === '') {
      fetchReadme();
    }
  };

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
      modalTitle.innerHTML = '<span class="emoji">📖</span> Documentation';
    } else if (currentTab === 'test-results') {
      modalTitle.innerHTML = '<span class="emoji">🧪</span> Test Results';
    }
  }

  // Close modal when clicking outside of it
  window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
      closeModal();
    }
  };

  // Fetch configuration data
  function fetchConfig() {
    const configContent = document.getElementById('config-content');
    configContent.innerHTML = '<div style="text-align: center; padding: 20px;">Loading configuration...</div>';
    
    fetch('/config')
      .then(response => response.json())
      .then(config => {
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
      })
      .catch(err => {
        console.error('Error fetching configuration:', err);
        configContent.innerHTML = '<p>Error fetching configuration</p>';
      });
  }

  // Fetch README content
  function fetchReadme() {
    const readmeContent = document.getElementById('readme-content');
    readmeContent.innerHTML = '<div style="text-align: center; padding: 20px;">Loading documentation...</div>';
    
    fetch('/static/README.md')
      .then(response => response.text())
      .then(text => {
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
            const formattedLine = line.replace(/`([^`]+)`/g, '<code>$1</code>');
            html += `<p>${formattedLine}</p>`;
          } else {
            html += '<br>';
          }
        }
        
        if (inList) {
          html += '</ul>';
        }
        
        html += '</div>';
        readmeContent.innerHTML = html;
      })
      .catch(err => {
        console.error('Error fetching README:', err);
        readmeContent.innerHTML = '<p>Error loading documentation. Please check the GitHub repository.</p>';
      });
  }
})();
