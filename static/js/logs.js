/* logs.js */
(function() {
  function formatTimestamp(isoTimestamp) {
    try {
      const date = new Date(isoTimestamp);
      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      };
      return date.toLocaleString(navigator.language || 'en-US', options);
    } catch (e) {
      return isoTimestamp;
    }
  }

  function colorizeStatusCodes(text) {
    text = text.replace(/(\s|HTTP\s+)(2\d{2})(\s|[,.])/g, '$1<span class="status-2xx">$2</span>$3');
    text = text.replace(/(\s|HTTP\s+)(3\d{2})(\s|[,.])/g, '$1<span class="status-3xx">$2</span>$3');
    text = text.replace(/(\s|HTTP\s+)(4\d{2})(\s|[,.])/g, '$1<span class="status-4xx">$2</span>$3');
    text = text.replace(/(\s|HTTP\s+)(5\d{2})(\s|[,.])/g, '$1<span class="status-5xx">$2</span>$3');
    return text;
  }

  function colorizeNumbers(text) {
    text = text.replace(/(?<![<>a-zA-Z]class="|[<>])(\d+)(?![^<>]*>)/g, '<span class="number">$1</span>');
    return text;
  }

  function formatLogEntry(text) {
    text = text.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.+-]\d+)/g, function(match) {
      return '<span class="timestamp">' + formatTimestamp(match) + '</span>';
    });
    
    text = text.replace(/([^<])(✅|🆗|✓)(.+?)(<br>|$)/g, '$1<span class="log-success">$2$3</span>$4');
    text = text.replace(/([^<])(❌|🛑|✗)(.+?)(<br>|$)/g, '$1<span class="log-error">$2$3</span>$4');
    text = text.replace(/([^<])(⚠️|🔶)(.+?)(<br>|$)/g, '$1<span class="log-warning">$2$3</span>$4');
    text = text.replace(/([^<])(🧪|🔬)(.+?)(<br>|$)/g, '$1<span class="log-test">$2$3</span>$4');
    text = text.replace(/([^<])(📥|📤|📬|ℹ️|🧹|🔄|🔒)(.+?)(<br>|$)/g, '$1<span class="log-normal">$2$3</span>$4');


    text = colorizeStatusCodes(text);
    text = colorizeNumbers(text);

    text = text.replace(/running \d+ tests/g, '<strong class="log-test">$&</strong>');
    text = text.replace(/(test .+? \.\.\. )(ok)/g, '$1<span class="log-success">$2</span>');
    text = text.replace(/(test .+? \.\.\. )(FAILED)/g, '$1<span class="log-error">$2</span>');
    text = text.replace(/test result: (FAILED)/g, 'test result: <span class="log-error">$1</span>');
    text = text.replace(/test result: (ok)/g, 'test result: <span class="log-success">$1</span>');
    text = text.replace(/(panicked at)/g, '<span class="log-error">$1</span>');
    text = text.replace(/(Error|Failed|FAILED|error:)([^<]+)(<br>|$)/gi, '<span class="log-error">$1$2</span>$3');
    
    return text;
  }

  window.fetchLogs = function() {
    fetch('/logs')
      .then(response => response.text())
      .then(rawText => {
        let text = rawText.replace(/\n/g, '<br>');
        text = formatLogEntry(text);
        document.getElementById('logs').innerHTML = text;
        const logsDiv = document.getElementById('logs');
        logsDiv.scrollTop = logsDiv.scrollHeight;
      })
      .catch(err => {
        console.error('Error fetching logs:', err);
        document.getElementById('logs').textContent = 'Error fetching logs';
      });
  };
})();
