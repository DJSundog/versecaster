let socket = io();

let toaster = {
  authorized:   false,
  initialized:  false,
  audioInputs:  [],
  videoInputs:  [],
  audioOutputs: [],
  videoOutputs: [],
  decks:        []
};

toaster.audioInputs.view = document.querySelector('#audioInputs');
toaster.videoInputs.view = document.querySelector('#videoInputs');
toaster.audioOutputs.view = document.querySelector('#audioOutputs');
toaster.videoOutputs.view = document.querySelector('#videoOutputs');
toaster.decks.view = document.querySelector('#decks');

// set up recorder for test output
toaster.recorder = new CanvasRecorder(document.querySelector('#testVideoOutput'), {type: 'canvas', disableLogs: false});

const handleErrors = (err) => {
  console.log(err.name + ': ' + err.message);
  console.dir(err);
};

const gUMauth = (stream) => {
  // stop any streams from auth device
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();    
    });
  }
  
  toaster.authorized = true;
  
  // get all devices
  navigator.mediaDevices.enumerateDevices()
    .then(populateToaster)
    .catch(handleErrors);
};

const populateToaster = (devices) => {
  devices.forEach((device) => {
    console.log(device.kind + ': ' + device.label + ' (deviceId: ' + device.deviceId + ')');
    // ignoring system-chosen default devices as they are duplicates of other devices
    if (device.deviceId !== 'default') {
      switch(device.kind) {
        case 'audioinput':
          var audioInput = {};
          audioInput.device = device;
          audioInput.device.preview = document.createElement('audio');
          audioInput.device.view = document.createElement('section');
          audioInput.device.view.style = 'display: inline-block;';
          var label = document.createElement('h2');
          label.innerText = device.label;
          audioInput.device.view.appendChild(label);
          audioInput.device.gainMeter = document.createElement('canvas');
          audioInput.device.gainMeter.style = 'border: 1px solid black;';
          audioInput.device.gainMeter.width = 30;
          audioInput.device.gainMeter.height = 130;
          audioInput.device.view.appendChild(audioInput.device.gainMeter);
          toaster.audioInputs.view.appendChild(audioInput.device.preview);
          toaster.audioInputs.view.appendChild(audioInput.device.view);
          initializeAudioInput(audioInput.device);
          toaster.audioInputs.push(audioInput);
          break;
        case 'audiooutput':
          var audioOutput = {};
          audioOutput.device = device;
          audioOutput.device.preview = document.createElement('audio');
          audioOutput.device.view = document.createElement('canvas');
          toaster.audioOutputs.view.appendChild(audioOutput.device.preview);
          toaster.audioOutputs.view.appendChild(audioOutput.device.view);
          toaster.audioOutputs.push(audioOutput);
          break;
        case 'videoinput':
          var videoInput = {};
          videoInput.device  = device;
          videoInput.device.preview = document.createElement('video');
          videoInput.device.view = document.createElement('canvas');
          videoInput.device.resolutions = getResolutions(videoInput.device);
          toaster.videoInputs.view.appendChild(videoInput.device.preview);
          toaster.videoInputs.view.appendChild(videoInput.device.view);
          toaster.videoInputs.push(videoInput);
          break;
        case 'videooutput':
          
          break;
        default:
          console.log('unknown device kind: ' + device.kind);
          break;
      }
    }
  });
  toaster.initialized = true;
  console.dir(toaster);
};

const getResolutions = (device) => {
  let candidates = [
    { width: 1920, height: 1080 },
    { width: 1600, height: 1200 },
    { width: 1280, height: 720 },
    { width: 640,  height: 480 }
  ];
  
  let resolutions = [];
  let counter = 0;
  
  candidates.forEach((candidate) => {
    var constraints = {
      audio: false,
      video: {
        deviceId: { exact: device.deviceId },
        width:    { exact: candidate.width },
        height:   { exact: candidate.height }
      }
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        resolutions.push(candidate);
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        counter++;
        if (counter >= candidates.length) {
          setDeviceResolution(device, resolutions[0]);
        }
      })
      .catch((err) => {
        counter++;  
        if (counter >= candidates.length) {
          setDeviceResolution(device, resolutions[0]);
        }
      });
  });
  
  return resolutions;
};

const setDeviceResolution = (device, resolution) => {
  var constraints = {
    audio: false,
    video: {
      deviceId: { exact: device.deviceId },
      width:    { exact: resolution.width },
      height:   { exact: resolution.height }
    }
  };
  
  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      previewVideoInput(device, stream);
    })
    .catch(handleErrors);
};

const previewVideoInput = (device, stream) => {
  var video       = device.preview;
  var view        = device.view;
  device.stream   = stream;
  video.srcObject = stream;
  video.play();
  video.onloadedmetadata = () => {
    var testVideoOutput = document.querySelector('#testVideoOutput');
    view.width = video.videoWidth / 2;
    view.height = video.videoHeight / 2;
    testVideoOutput.width = video.videoWidth;
    testVideoOutput.height = video.videoHeight;
    updateVideoOutputs();
  };
};

const crossfader = document.querySelector('#crossfader');
crossfader.addEventListener('input',(evt) => {
  //console.log('xfade: ' + evt.target.value);
});

const deckAfade = document.querySelector('#deckAfade');
deckAfade.addEventListener('click', (evt) => {
  crossfader.value = 0;
});

const deckBfade = document.querySelector('#deckBfade');
deckBfade.addEventListener('click', (evt) => {
  crossfader.value = 100;
});

const recordingControl = document.querySelector('#recordingControl');
recordingControl.addEventListener('click', (evt) => {
  if (toaster.recorder.recording) {
    toaster.recorder.stop((videoBlob) => {
      toaster.recorder.recording = false;
      // temp hack to display video
      var player = document.createElement('video');
      player.controls = true;
      player.style.display = "block";
      player.src = URL.createObjectURL(videoBlob);
      toaster.decks.view.appendChild(player);
      evt.target.innerText = "Start recording";
    });
  } else {
    toaster.recorder.record();
    toaster.recorder.recording = true;
    evt.target.innerText = "Stop recording";
  }
});

const initializeAudioInput = (device) => {
  let constraints = {
    video: false,
    audio: {
      deviceId: {
        exact: device.deviceId
      }
    }
  };
  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      device.stream = stream;
      device.context = new AudioContext();
      device.audioSource = device.context.createMediaStreamSource(device.stream);
      device.analyzer = device.context.createAnalyser();
      device.analyzer.smoothingTimeConstant = 0.3;
      device.analyzer.fftSize = 1024;
      device.audioSource.connect(device.analyzer);
    })
    .catch(handleErrors);
};

const getAverageVolume = (array) => {
  let values = 0;
  let average;
  
  let length = array.length;
  
  for (let i = 0; i < length; i++) {
    values += array[i];
  }
  
  average = values / length;
  
  return average;
};

const updateVideoOutputs = () => {
  let canvas = document.querySelector('#testVideoOutput');
  let ctx = canvas.getContext("2d");
  
  let viewA = toaster.videoInputs[0].device.view;
  let viewB = toaster.videoInputs[1].device.view;
  
  let ctxA  = viewA.getContext("2d");
  let ctxB  = viewB.getContext("2d");
  
  let deckAopacity = 100 - crossfader.value;
  let deckBopacity = crossfader.value;
  
  let previewA = toaster.videoInputs[0].device.preview;
  let previewB = toaster.videoInputs[1].device.preview;
  
  // update preview images in local ui
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = deckAopacity / 100;
  ctx.drawImage(previewA, 0, 0, canvas.width, canvas.height);
  ctxA.drawImage(previewA, 0, 0, viewA.width, viewA.height);

  ctx.globalAlpha = deckBopacity / 100;
  ctx.drawImage(previewB, 0, 0, canvas.width, canvas.height);
  ctxB.drawImage(previewB, 0, 0, viewB.width, viewB.height);
  
  for (let audioInput of toaster.audioInputs) {
    if (audioInput.device.analyzer) {
      let array = new Uint8Array(audioInput.device.analyzer.frequencyBinCount);
      audioInput.device.analyzer.getByteFrequencyData(array);
      let average = getAverageVolume(array);
      
      let context = audioInput.device.gainMeter.getContext("2d");
      let gradient = context.createLinearGradient(0,0,0,130);
      gradient.addColorStop(1,'#000000');
      gradient.addColorStop(0.75,'#ff0000');
      gradient.addColorStop(0.25,'#ffff00');
      gradient.addColorStop(0,'#ffffff');

      context.clearRect(0, 0, 60, 130);
      context.fillStyle = gradient;
      context.fillRect(0, 130 - average, 25, 130);
    }
  }

  // send output over websocket
  
  requestAnimationFrame(updateVideoOutputs);
};

window.onload = () => {
  let authButton = document.querySelector('#authButton');
  authButton.addEventListener('click', (event) => {
    // no longer need the button
    event.target.style.display = 'none';
    
    // ask for access to an a/v device to trigger
    // browser permissions popup
    var authConstraints = { audio: true, video: true };
    
    navigator.mediaDevices.getUserMedia(authConstraints)
      .then(gUMauth)
      .catch(handleErrors);
  });
};
