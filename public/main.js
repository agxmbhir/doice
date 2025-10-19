let mediaRecorder;
let recordedChunks = [];
let startTime = 0;
let timerInterval;

const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const timerEl = document.getElementById('timer');
const player = document.getElementById('player');
const statusEl = document.getElementById('status');
const share = document.getElementById('share');
const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');

function formatTime(ms){
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const r = s % 60;
  return `${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`;
}

function startTimer(){
  startTime = Date.now();
  timerInterval = setInterval(()=>{
    timerEl.textContent = formatTime(Date.now()-startTime);
  }, 250);
}

function stopTimer(){
  clearInterval(timerInterval);
}

async function startRecording(){
  recordedChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeTypeOptions = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ];
  const mimeType = mimeTypeOptions.find(type => MediaRecorder.isTypeSupported(type)) || '';
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stopTimer();
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    player.classList.remove('hidden');
    player.src = URL.createObjectURL(blob);
    statusEl.textContent = 'Uploading…';
    try{
      const form = new FormData();
      form.append('file', blob, `memo-${Date.now()}.webm`);
      const res = await fetch('/api/upload', { method:'POST', body: form });
      if(!res.ok) throw new Error('Upload failed');
      const { id, url } = await res.json();
      const shareUrl = `${location.origin}/s/${id}`;
      shareLink.value = shareUrl;
      share.classList.remove('hidden');
      statusEl.textContent = 'Ready to share!';
      if('clipboard' in navigator){
        try{ await navigator.clipboard.writeText(shareUrl); statusEl.textContent = 'Link copied to clipboard!'; }catch{}
      }
    }catch(err){
      statusEl.textContent = 'Upload error';
      console.error(err);
    }
  };

  mediaRecorder.start(100); // small chunks for quick stop->upload
  startTimer();
}

recordBtn?.addEventListener('click', async()=>{
  recordBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = 'Recording…';
  await startRecording();
});

stopBtn?.addEventListener('click', ()=>{
  stopBtn.disabled = true;
  recordBtn.disabled = false;
  if(mediaRecorder && mediaRecorder.state !== 'inactive'){
    mediaRecorder.stop();
  }
  statusEl.textContent = 'Processing…';
});

copyBtn?.addEventListener('click', async()=>{
  try{
    await navigator.clipboard.writeText(shareLink.value);
    statusEl.textContent = 'Copied!';
  }catch{
    shareLink.select();
    document.execCommand('copy');
  }
});


