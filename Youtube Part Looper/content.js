// initialize variables
let loopInterval = null;
let loopStart = 0;
let loopEnd = 0;

// function that gets the time of a video and sets it to seconds
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  let seconds = 0;
  if (parts.length === 3) { // h:m:s
    seconds += parts[0] * 3600;
    seconds += parts[1] * 60;
    seconds += parts[2];
  } else if (parts.length === 2) { //m:s
    seconds += parts[0] * 60;
    seconds += parts[1];
  } else { // s only
    seconds += parts[0];
  }
  return seconds;
}

// this returns the youtube tabs player 
function getYouTubePlayer() {
  // try accesing the player directly
  let player = document.getElementById('movie_player');
  
  // if it doesnt work try to get
  if (!player || typeof player.getCurrentTime !== 'function') {
    // try window.ytplayer ,works foro ldwer youtube
    if (window.ytplayer && window.ytplayer.config) {
      player = document.getElementById('movie_player');
    }
    
    // try accessing through the video element
    const video = document.querySelector('video.video-stream');
    if (video && video.readyState >= 2) {
      // create a wrapper object that mimics YouTube player API
      return {
        getCurrentTime: () => video.currentTime,
        getPlayerState: () => {
          if (video.paused) return 2; // paused
          return 1; // playing
        },
        seekTo: (seconds, allowSeekAhead) => {
          video.currentTime = seconds;
        }
      };
    }
    
    // try finding player through ytd-player web component
    const ytdPlayer = document.querySelector('ytd-player');
    if (ytdPlayer) {
      const innerPlayer = ytdPlayer.querySelector('#movie_player');
      if (innerPlayer && typeof innerPlayer.getCurrentTime === 'function') {
        player = innerPlayer;
      }
    }
  }
  
  // if player exists and has methods, return it
  if (player && typeof player.getCurrentTime === 'function' && typeof player.seekTo === 'function') {
    return player;
  }
  
  // if no valid player found, return null
  return null;
}

function checkLoop() {
  const player = getYouTubePlayer();

  // if player doesnt exist, wait (probably an ad)
  if (!player) {
    return;
  }
  
  // check if player methods are available
  if (typeof player.getCurrentTime !== 'function' || typeof player.getPlayerState !== 'function' || typeof player.seekTo !== 'function') {
    return; // player isnt ready wait
  }
  
  // use players own incorporated function to get the time
  const currentTime = player.getCurrentTime();

  // use players own incorporated function to check if its active or not ( active=1,not active=0)
  const playerState = player.getPlayerState();

  // if the video is playing and the time is higher or equal than when we want the loop to end
  if (playerState === 1 && currentTime >= loopEnd) {
    // restart the loop
    player.seekTo(loopStart, true);
  }
}

function startLoop(start, end) {
  stopLoop(); // clear any existing loop
  loopStart = start; //both given by user
  loopEnd = end;
  loopInterval = setInterval(checkLoop, 250); // checks once every 250ms
}

function stopLoop() {
  if (loopInterval) { // if there is a loop
    clearInterval(loopInterval); // clear setInterval so that it doesnt check anymore
    loopInterval = null;
  }
}

// helper function to wait for player to be ready
function waitForPlayer(maxAttempts = 20, callback) {
  let attempts = 0;
  const checkPlayer = () => {
    attempts++;
    const player = getYouTubePlayer();
    
    if (player && typeof player.getCurrentTime === 'function' && typeof player.seekTo === 'function') {
      callback(player);
    } else if (attempts < maxAttempts) {
      setTimeout(checkPlayer, 300);
    } else {
      console.error("YT Looper: Player not ready after", maxAttempts, "attempts");
      console.error("YT Looper: Debug info - movie_player:", document.getElementById('movie_player'));
      console.error("YT Looper: Debug info - video element:", document.querySelector('video.video-stream'));
      callback(null);
    }
  };
  checkPlayer();
}

// prevent duplicate message listener registration
if (!window.ytLooperListenerRegistered) {
  window.ytLooperListenerRegistered = true;

  // this checks for any messages sent from popup
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) { // get user input
      
      if (request.command === "start") { // if command is start
        // wait for player to be ready
        waitForPlayer(10, (player) => {
          
          // only start if the player is present and it has its function seekTo which we use in our popup code
          if (player && typeof player.seekTo === 'function') {
            const startTimeInSeconds = parseTimeToSeconds(request.start); // converts user input to seconds
            const endTimeInSeconds = parseTimeToSeconds(request.end); 
            
            if (endTimeInSeconds > startTimeInSeconds && startTimeInSeconds >= 0) { // loop shouldnt work if the end is earlier than the beggining
              startLoop(startTimeInSeconds, endTimeInSeconds);
              // jump to start time
              player.seekTo(startTimeInSeconds, true);
            } else {
              console.error(`YT Looper: Invalid times - Start: ${startTimeInSeconds}s, End: ${endTimeInSeconds}s. End time must be after start time.`);
            }
          } else {
            // player not found, waitForPlayer would have logged the error
          }
        });
      } else if (request.command === "stop") { // stop loop
        stopLoop();
      }
      
      // return true to indicate we might send an async response
      return true;
    }
  );
} 