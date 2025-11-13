// function that injects the content script if it's not already loaded
function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }, function(result) {
    if (chrome.runtime.lastError) {
      callback(false); // failed to inject script
    } else {
      // wait for script to load to inialize message
      setTimeout(callback, 300, true);
    }
  });
}

// function that sends a message to the active script window
function sendMessageToContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) { // look for the current window's tabs and upon finding all tabs execute function below
    if (tabs[0] && tabs[0].id) { // safety measure that checks if it found a tab and if it has an id
      // check if current tab is youtube tab
      if (!tabs[0].url || !tabs[0].url.includes('youtube.com/watch')) {
        console.error("YT Looper: Please navigate to a YouTube video page first.");
        alert("Please navigate to a YouTube video page first.");
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
        const error = chrome.runtime.lastError;
        
        if (error) {
          // if message failed, try to inject the script and retry
          injectContentScript(tabs[0].id, function(success) {
            if (success) {
              // wait a bit more and retry sending the message after injection
              setTimeout(function() {
                chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                  const retryError = chrome.runtime.lastError;
                  if (retryError) {
                    console.error("YT Looper: Retry failed - " + retryError.message);
                    alert("Could not connect to YouTube page. Please refresh the page and try again.");
                  }
                });
              }, 500);
            } else {
              console.error("YT Looper: Script injection failed!");
              alert("Could not inject content script. Please refresh the YouTube page and try again.");
            }
          });
        } else {
          // Message sent successfully
        }
      });
    } else {
      console.error("Could not find active tab."); // if there are no active tabs
    }
  });
}

// function that acts as a safety measure in the case the script loads faster than the popup.html, in which case the script would crash
document.addEventListener('DOMContentLoaded', function() {
  // click listener for the "Start Loop" button which acts as a waiting block that begins execution only upon user input
  document.getElementById('loopButton').addEventListener('click', function() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!startTime || !endTime) {
      alert("Please enter both start and end times.");
      return;
    }

    sendMessageToContentScript({ // start script
      command: "start", 
      start: startTime,
      end: endTime
    });
  });

  // same as "Start Loop" but for "Stop Loop"
  document.getElementById('stopButton').addEventListener('click', function() {
    sendMessageToContentScript({
      command: "stop"
    });
  });
});