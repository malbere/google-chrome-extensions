chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadAudio') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: downloadAudio
        });
      });
    }
  });
  
  async function downloadAudio() {
    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  
    function interleave(inputL, inputR) {
      const length = inputL.length + inputR.length;
      const result = new Float32Array(length);
  
      let index = 0;
      let inputIndex = 0;
  
      while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
      }
      return result;
    }
  
    function audioBufferToWavBlob(audioBuffer) {
      const numOfChan = audioBuffer.numberOfChannels;
      const length = audioBuffer.length * numOfChan * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);
  
      /* RIFF identifier */
      writeString(view, 0, 'RIFF');
      /* RIFF chunk length */
      view.setUint32(4, 36 + audioBuffer.length * 2 * numOfChan, true);
      /* RIFF type */
      writeString(view, 8, 'WAVE');
      /* format chunk identifier */
      writeString(view, 12, 'fmt ');
      /* format chunk length */
      view.setUint32(16, 16, true);
      /* sample format (raw) */
      view.setUint16(20, 1, true);
      /* channel count */
      view.setUint16(22, numOfChan, true);
      /* sample rate */
      view.setUint32(24, audioBuffer.sampleRate, true);
      /* byte rate (sample rate * block align) */
      view.setUint32(28, audioBuffer.sampleRate * 4, true);
      /* block align (channel count * bytes per sample) */
      view.setUint16(32, numOfChan * 2, true);
      /* bits per sample */
      view.setUint16(34, 16, true);
      /* data chunk identifier */
      writeString(view, 36, 'data');
      /* data chunk length */
      view.setUint32(40, audioBuffer.length * numOfChan * 2, true);
  
      // Write interleaved data
      if (numOfChan === 2) {
        const interleaved = interleave(
          audioBuffer.getChannelData(0),
          audioBuffer.getChannelData(1)
        );
        let index = 44;
        for (let i = 0; i < interleaved.length; i++) {
          view.setInt16(index, interleaved[i] * (0x7fff * 1.0), true);
          index += 2;
        }
      } else {
        let offset = 44;
        for (let i = 0; i < audioBuffer.length; i++) {
          const sample = audioBuffer.getChannelData(0)[i] * 0x7fff;
          view.setInt16(offset, sample, true);
          offset += 2;
        }
      }
  
      return new Blob([buffer], { type: 'audio/wav' });
    }
  
    const videoElement = document.querySelector('video');
    if (videoElement) {
      try {
        // Fetch the video as a blob
        const response = await fetch(videoElement.src);
        const videoBlob = await response.blob();
  
        // Extract audio using AudioContext
        const audioContext = new AudioContext();
        const arrayBuffer = await videoBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
        // Convert audioBuffer to a Blob (WAV format)
        const wavBlob = audioBufferToWavBlob(audioBuffer);
  
        // Create a downloadable link
        const a = document.createElement('a');
        const url = URL.createObjectURL(wavBlob);
        a.href = url;
        a.download = 'tiktok-audio.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to download audio:', error);
        alert('Failed to download audio.');
      }
    } else {
      alert('No video found on the page.');
    }
  }
  