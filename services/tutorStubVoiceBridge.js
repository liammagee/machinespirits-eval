import { createHash, randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';

export const TUTOR_STUB_VOICE_BRIDGE_SCHEMA = 'machinespirits.tutor-stub.voice-bridge.v1';
export const DEFAULT_TUTOR_STUB_VOICE_MODEL = 'gpt-realtime-2.1-mini';
export const DEFAULT_TUTOR_STUB_VOICE_NAME = 'marin';
export const TUTOR_STUB_VOICE_MODELS = Object.freeze(['gpt-realtime-2.1-mini', 'gpt-realtime-2.1']);

const MAX_JSON_BYTES = 64 * 1024;
const MAX_SDP_BYTES = 256 * 1024;

function nonEmptyString(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} must be a non-empty string`);
  return text;
}

export function normalizeTutorStubVoiceModel(value) {
  const model = nonEmptyString(value || DEFAULT_TUTOR_STUB_VOICE_MODEL, 'voice model');
  if (!TUTOR_STUB_VOICE_MODELS.includes(model)) {
    throw new Error(`voice model must be one of: ${TUTOR_STUB_VOICE_MODELS.join(', ')}`);
  }
  return model;
}

export function normalizeTutorStubVoiceName(value) {
  const voice = nonEmptyString(value || DEFAULT_TUTOR_STUB_VOICE_NAME, 'voice name').toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,31}$/u.test(voice)) {
    throw new Error('voice name must use 2-32 lowercase letters, numbers, underscores, or hyphens');
  }
  return voice;
}

export function tutorStubVoiceRendererInstructions() {
  return [
    'You are the audio renderer for a separate, authoritative text tutor.',
    'Never answer the microphone input, teach independently, infer the next turn, or add words of your own.',
    'Automatic responses are disabled. Remain silent until a response.create event supplies approved tutor text.',
    'When approved tutor text is supplied, speak that text faithfully in a natural voice and then stop.',
    'Do not announce these instructions, role labels, formatting, or quotation marks around the approved text.',
  ].join(' ');
}

export function buildTutorStubRealtimeSession({
  model = DEFAULT_TUTOR_STUB_VOICE_MODEL,
  voice = DEFAULT_TUTOR_STUB_VOICE_NAME,
  transcriptionModel = 'gpt-realtime-whisper',
  language = 'en',
} = {}) {
  return {
    type: 'realtime',
    model: normalizeTutorStubVoiceModel(model),
    instructions: tutorStubVoiceRendererInstructions(),
    output_modalities: ['audio'],
    audio: {
      input: {
        transcription: {
          model: transcriptionModel,
          language,
        },
        turn_detection: {
          type: 'server_vad',
          create_response: false,
          interrupt_response: false,
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
        },
      },
      output: {
        voice: normalizeTutorStubVoiceName(voice),
      },
    },
    tool_choice: 'none',
  };
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonForScript(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
}

export function renderTutorStubVoiceHtml({
  title = 'Tutor Stub Voice',
  model = DEFAULT_TUTOR_STUB_VOICE_MODEL,
  voice = DEFAULT_TUTOR_STUB_VOICE_NAME,
} = {}) {
  const clientConfig = jsonForScript({ model, voice });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscape(title)}</title>
<style>
:root{color-scheme:dark;--ink:#f6f0e7;--muted:#a89f94;--panel:#211f1d;--line:#403b36;--tutor:#bd86ff;--learner:#4ce093;--accent:#f4b860;--bad:#ff7b72}*{box-sizing:border-box}body{margin:0;background:#151514;color:var(--ink);font:16px/1.48 ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:940px;margin:0 auto;padding:34px 24px 64px}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid var(--line);padding-bottom:22px}h1{font:700 clamp(2rem,6vw,4.6rem)/.98 Georgia,serif;margin:0 0 10px}.eyebrow{color:var(--accent);letter-spacing:.16em;text-transform:uppercase;font-size:.76rem}.sub{color:var(--muted);max-width:650px}.status{border:1px solid var(--line);border-radius:999px;padding:8px 13px;white-space:nowrap;color:var(--muted)}.status.live{color:var(--learner);border-color:var(--learner)}.controls{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}button{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:11px 15px;cursor:pointer}button.primary{background:var(--ink);color:#171615;font-weight:700}button:disabled{opacity:.45;cursor:not-allowed}.meters{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}.meter{padding:13px;border:1px solid var(--line);background:var(--panel);border-radius:8px}.meter b{display:block;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}.transcript{border-top:1px solid var(--line)}.message{padding:18px 4px;border-bottom:1px solid var(--line)}.message b{display:block;margin-bottom:5px}.message.tutor b{color:var(--tutor)}.message.learner b{color:var(--learner)}.message.system b{color:var(--accent)}.message p{margin:0;white-space:pre-wrap}.message.interim{opacity:.62}.empty{color:var(--muted);padding:26px 4px}.foot{margin-top:18px;color:var(--muted);font-size:.86rem}.error{color:var(--bad)}@media(max-width:650px){header{display:block}.status{display:inline-block;margin-top:14px}.meters{grid-template-columns:1fr}}
</style>
</head>
<body><main>
<header><div><div class="eyebrow">Machinespirits · live companion</div><h1>${htmlEscape(title)}</h1><div class="sub">Your microphone becomes the same learner turn used by the CLI. The existing interpretation, evidence tracking, teaching-style selection, response checks, and trace remain authoritative.</div></div><div id="status" class="status">not connected</div></header>
<div class="controls"><button id="connect" class="primary">Connect microphone</button><button id="mic" disabled>Mute microphone</button><button id="repeat" disabled>Repeat latest tutor reply</button><button id="disconnect" disabled>Disconnect</button></div>
<div class="meters"><div class="meter"><b>Voice model</b><span id="model"></span></div><div class="meter"><b>Voice</b><span id="voice"></span></div><div class="meter"><b>Input</b><span id="input-state">waiting</span></div></div>
<audio id="remote" autoplay></audio><section id="transcript" class="transcript"><div class="empty">Connect the microphone. The latest visible tutor message will be available to repeat.</div></section>
<div class="foot">Barge in naturally: current speech is cancelled, your completed phrase is appended to the pending learner turn, and the text tutor regenerates from the full compound input. Closing this page does not end the CLI session.</div>
</main>
<script>
const CONFIG=${clientConfig};
const token=new URLSearchParams(location.search).get('token')||'';
const statusEl=document.querySelector('#status'),connectButton=document.querySelector('#connect'),micButton=document.querySelector('#mic'),repeatButton=document.querySelector('#repeat'),disconnectButton=document.querySelector('#disconnect'),remoteAudio=document.querySelector('#remote'),transcriptEl=document.querySelector('#transcript'),inputState=document.querySelector('#input-state');
document.querySelector('#model').textContent=CONFIG.model;document.querySelector('#voice').textContent=CONFIG.voice;
let pc=null,dc=null,stream=null,eventSource=null,currentResponseId=null,latestTutor=null,speakingDelivery=null,spokenBuffer='',seenDeliveries=new Set(),muted=false,awaitingTutor=false;
function setStatus(text,kind=''){statusEl.textContent=text;statusEl.className='status '+kind}
function message(kind,label,text,interim=false){const empty=transcriptEl.querySelector('.empty');if(empty)empty.remove();const row=document.createElement('article');row.className='message '+kind+(interim?' interim':'');const head=document.createElement('b');head.textContent=label;const body=document.createElement('p');body.textContent=text;row.append(head,body);transcriptEl.append(row);row.scrollIntoView({block:'nearest'});return row}
function send(event){if(dc&&dc.readyState==='open')dc.send(JSON.stringify(event))}
function cancelSpeech(reason='learner_interruption'){const hadResponse=Boolean(currentResponseId);if(currentResponseId)send({type:'response.cancel',response_id:currentResponseId});currentResponseId=null;remoteAudio.pause();remoteAudio.currentTime=0;if(reason==='learner_barge_in'&&(hadResponse||awaitingTutor))fetch('/api/interrupt?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason,hadResponse,awaitingTutor})}).catch(()=>{});setTimeout(()=>remoteAudio.play().catch(()=>{}),80)}
function speakTutor(delivery,forceSpeak=false){latestTutor=delivery;awaitingTutor=false;repeatButton.disabled=!(dc&&dc.readyState==='open');const seen=delivery.deliveryId&&seenDeliveries.has(delivery.deliveryId);if(!seen){if(delivery.deliveryId)seenDeliveries.add(delivery.deliveryId);message('tutor','Tutor',delivery.text)}if(seen&&!forceSpeak)return;if(!(dc&&dc.readyState==='open'))return;cancelSpeech('approved_tutor_replacement');speakingDelivery=delivery;spokenBuffer='';send({type:'response.create',response:{output_modalities:['audio'],instructions:'Speak exactly the approved tutor text below. Do not add, remove, explain, answer, or paraphrase any words. Begin immediately with the first word and stop after the final word.\\n\\nAPPROVED TUTOR TEXT:\\n'+delivery.text}})}
function openEvents(){if(eventSource)eventSource.close();eventSource=new EventSource('/api/events?token='+encodeURIComponent(token));eventSource.addEventListener('tutor',event=>speakTutor(JSON.parse(event.data)));eventSource.addEventListener('bridge',event=>{const data=JSON.parse(event.data);if(data.message)message('system','Voice bridge',data.message)});eventSource.onerror=()=>setStatus('CLI bridge reconnecting')}
async function submitLearner(text,itemId){const clean=String(text||'').trim();if(!clean)return;message('learner','Learner',clean);inputState.textContent='sent to tutor';awaitingTutor=true;const response=await fetch('/api/learner?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:clean,itemId})});if(!response.ok){awaitingTutor=false;const detail=await response.text();throw new Error(detail||'learner turn was not accepted')}inputState.textContent='listening'}
function handleRealtime(event){if(event.type==='response.created')currentResponseId=event.response&&event.response.id||null;if(event.type==='response.done'||event.type==='response.cancelled'){currentResponseId=null;inputState.textContent='listening'}if(event.type==='input_audio_buffer.speech_started'){inputState.textContent='hearing you';cancelSpeech('learner_barge_in')}if(event.type==='input_audio_buffer.speech_stopped')inputState.textContent='transcribing';if(event.type==='conversation.item.input_audio_transcription.delta'){let row=document.querySelector('[data-live-transcript]');if(!row){row=message('learner','Learner · hearing…','',true);row.dataset.liveTranscript='1'}row.querySelector('p').textContent+=event.delta||''}if(event.type==='conversation.item.input_audio_transcription.completed'){const row=document.querySelector('[data-live-transcript]');if(row)row.remove();submitLearner(event.transcript,event.item_id).catch(error=>{message('system','Voice error',error.message);setStatus('input failed','error')})}if(event.type==='response.output_audio_transcript.delta')spokenBuffer+=event.delta||'';if(event.type==='response.output_audio_transcript.done'&&speakingDelivery){const transcript=event.transcript||spokenBuffer;fetch('/api/spoken?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deliveryId:speakingDelivery.deliveryId,transcript})}).then(response=>response.json()).then(result=>{if(!result.matchesCanonical)message('system','Voice audit','The audio renderer changed the approved wording; the CLI text remains authoritative.')}).catch(()=>{});speakingDelivery=null;spokenBuffer=''}if(event.type==='error'){const detail=event.error&&event.error.message||'Realtime error';message('system','Realtime error',detail);setStatus('error','error')}}
async function connect(){connectButton.disabled=true;setStatus('requesting microphone');try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});pc=new RTCPeerConnection();pc.ontrack=event=>{remoteAudio.srcObject=event.streams[0]};pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected'){setStatus('live','live');micButton.disabled=false;disconnectButton.disabled=false;repeatButton.disabled=!latestTutor;inputState.textContent='listening'}else if(['failed','disconnected','closed'].includes(pc.connectionState)){setStatus(pc.connectionState);}};stream.getTracks().forEach(track=>pc.addTrack(track,stream));dc=pc.createDataChannel('oai-events');dc.addEventListener('open',()=>{openEvents();if(latestTutor){repeatButton.disabled=false;speakTutor(latestTutor,true)}});dc.addEventListener('message',event=>{try{handleRealtime(JSON.parse(event.data))}catch(error){message('system','Voice error',error.message)}});const offer=await pc.createOffer();await pc.setLocalDescription(offer);const answer=await fetch('/api/realtime/calls?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/sdp'},body:offer.sdp});if(!answer.ok)throw new Error(await answer.text());await pc.setRemoteDescription({type:'answer',sdp:await answer.text()})}catch(error){message('system','Connection error',error.message);setStatus('connection failed','error');connectButton.disabled=false;disconnect()}}
function disconnect(){if(eventSource){eventSource.close();eventSource=null}if(dc){dc.close();dc=null}if(pc){pc.close();pc=null}if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}remoteAudio.srcObject=null;micButton.disabled=true;repeatButton.disabled=true;disconnectButton.disabled=true;connectButton.disabled=false;setStatus('not connected');inputState.textContent='waiting'}
connectButton.addEventListener('click',connect);disconnectButton.addEventListener('click',disconnect);micButton.addEventListener('click',()=>{muted=!muted;if(stream)stream.getAudioTracks().forEach(track=>{track.enabled=!muted});micButton.textContent=muted?'Unmute microphone':'Mute microphone';inputState.textContent=muted?'muted':'listening'});repeatButton.addEventListener('click',()=>{if(latestTutor)speakTutor(latestTutor,true)});window.addEventListener('beforeunload',disconnect);openEvents();
</script></body></html>`;
}

async function readBody(request, maxBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      const error = new Error('request body is too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function safeOpenBrowser(url, { spawnImpl = spawn, platform = process.platform } = {}) {
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawnImpl(command, args, { detached: true, stdio: 'ignore' });
  child.once?.('error', () => {});
  child.unref?.();
  return { command, args };
}

function safetyIdentifier(runId) {
  return createHash('sha256')
    .update(String(runId || 'tutor-stub-voice'))
    .digest('hex')
    .slice(0, 32);
}

export function createTutorStubVoiceBridge({
  apiKey = process.env.OPENAI_API_KEY,
  model = DEFAULT_TUTOR_STUB_VOICE_MODEL,
  voice = DEFAULT_TUTOR_STUB_VOICE_NAME,
  title = 'Tutor Stub Voice',
  runId = null,
  host = '127.0.0.1',
  port = 0,
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  onLearnerTranscript = async () => ({ accepted: true }),
  onInterrupt = async () => ({ accepted: true }),
  onSpokenTranscript = async () => ({ accepted: true }),
  onEvent = () => {},
} = {}) {
  const session = buildTutorStubRealtimeSession({ model, voice });
  const token = randomBytes(24).toString('base64url');
  const clients = new Set();
  let server = null;
  let address = null;
  let latestTutor = null;
  const tutorDeliveries = new Map();
  let deliverySequence = 0;
  const createdAt = new Date().toISOString();

  function authorized(url, request) {
    const bearer = String(request.headers.authorization || '').replace(/^Bearer\s+/iu, '');
    return (
      url.searchParams.get('token') === token ||
      request.headers['x-tutor-stub-voice-token'] === token ||
      bearer === token
    );
  }

  function emit(type, payload) {
    const event = { type, at: new Date().toISOString(), ...payload };
    onEvent(event);
    const encoded = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(encoded);
    return event;
  }

  async function forwardOffer(request, response) {
    if (!apiKey) {
      writeJson(response, 503, { error: 'OPENAI_API_KEY is not configured for the local voice bridge' });
      return;
    }
    const offer = await readBody(request, MAX_SDP_BYTES);
    if (!offer.includes('v=0')) {
      writeJson(response, 400, { error: 'expected a WebRTC SDP offer' });
      return;
    }
    const form = new FormData();
    form.set('sdp', offer);
    form.set('session', JSON.stringify(session));
    const requestId = randomUUID();
    const upstream = await fetchImpl('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'OpenAI-Safety-Identifier': safetyIdentifier(runId),
        'X-Client-Request-Id': requestId,
      },
      body: form,
    });
    const body = await upstream.text();
    const openaiRequestId = upstream.headers.get('x-request-id');
    onEvent({
      type: 'voice_realtime_offer',
      at: new Date().toISOString(),
      requestId,
      openaiRequestId,
      status: upstream.status,
      model: session.model,
      voice: session.audio.output.voice,
    });
    if (!upstream.ok) {
      writeJson(response, upstream.status, {
        error: 'OpenAI Realtime session negotiation failed',
        detail: body.slice(0, 2000),
        requestId,
        openaiRequestId,
      });
      return;
    }
    response.writeHead(200, {
      'content-type': 'application/sdp',
      'cache-control': 'no-store',
      ...(openaiRequestId ? { 'x-openai-request-id': openaiRequestId } : {}),
    });
    response.end(body);
  }

  async function handleRequest(request, response) {
    const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
    if (!authorized(url, request)) {
      writeJson(response, 403, { error: 'voice bridge token is missing or invalid' });
      return;
    }
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/voice')) {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:",
      });
      response.end(renderTutorStubVoiceHtml({ title, model: session.model, voice: session.audio.output.voice }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      writeJson(response, 200, snapshot());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      response.write(
        `event: bridge\ndata: ${JSON.stringify({ message: 'Connected to the authoritative CLI tutor.' })}\n\n`,
      );
      if (latestTutor) response.write(`event: tutor\ndata: ${JSON.stringify(latestTutor)}\n\n`);
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/realtime/calls') {
      await forwardOffer(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/learner') {
      const body = JSON.parse((await readBody(request, MAX_JSON_BYTES)) || '{}');
      const text = nonEmptyString(body.text, 'learner transcript');
      const result = await onLearnerTranscript({
        text,
        itemId: body.itemId ? String(body.itemId) : null,
        receivedAt: new Date().toISOString(),
        source: 'openai_realtime_transcription',
      });
      const accepted = result?.accepted !== false;
      emit('bridge', {
        message: accepted
          ? 'Learner speech entered the CLI tutor turn.'
          : `Learner speech was not entered: ${result?.reason || 'the CLI is not accepting learner input'}.`,
        learnerAccepted: accepted,
      });
      writeJson(response, accepted ? 202 : 409, { accepted, result: result || null });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/interrupt') {
      const body = JSON.parse((await readBody(request, MAX_JSON_BYTES)) || '{}');
      const result = await onInterrupt({
        reason: body.reason ? String(body.reason) : 'learner_barge_in',
        receivedAt: new Date().toISOString(),
      });
      writeJson(response, 202, { accepted: true, result: result || null });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/spoken') {
      const body = JSON.parse((await readBody(request, MAX_JSON_BYTES)) || '{}');
      const deliveryId = nonEmptyString(body.deliveryId, 'voice delivery id');
      const transcript = nonEmptyString(body.transcript, 'spoken tutor transcript');
      const canonical = tutorDeliveries.get(deliveryId)?.text || null;
      const normalize = (text) =>
        String(text || '')
          .replace(/\s+/gu, ' ')
          .trim();
      const matchesCanonical = Boolean(canonical && normalize(canonical) === normalize(transcript));
      const result = await onSpokenTranscript({
        deliveryId,
        transcript,
        canonical,
        matchesCanonical,
        receivedAt: new Date().toISOString(),
      });
      writeJson(response, 200, { accepted: true, matchesCanonical, result: result || null });
      return;
    }
    writeJson(response, 404, { error: 'voice bridge route not found' });
  }

  function snapshot() {
    return {
      schema: TUTOR_STUB_VOICE_BRIDGE_SCHEMA,
      status: server?.listening ? 'listening' : 'stopped',
      createdAt,
      host,
      port: address?.port || null,
      model: session.model,
      voice: session.audio.output.voice,
      transcriptionModel: session.audio.input.transcription.model,
      automaticRealtimeResponses: false,
      authoritativeTutor: 'existing_cli_analysis_dag_register_guard_pipeline',
      connectedBrowsers: clients.size,
      tutorDeliveries: deliverySequence,
      apiKeyConfigured: Boolean(apiKey),
      url: address ? `http://${host}:${address.port}/voice?token=[redacted]` : null,
    };
  }

  async function start() {
    if (server?.listening) return { ...snapshot(), url: browserUrl() };
    server = http.createServer((request, response) => {
      handleRequest(request, response).catch((error) => {
        const statusCode = Number(error?.statusCode) || (error instanceof SyntaxError ? 400 : 500);
        if (!response.headersSent) writeJson(response, statusCode, { error: error.message });
        else response.end();
        onEvent({ type: 'voice_bridge_error', at: new Date().toISOString(), error: error.message });
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    address = server.address();
    onEvent({ type: 'voice_bridge_started', at: new Date().toISOString(), ...snapshot() });
    return { ...snapshot(), url: browserUrl() };
  }

  async function stop(reason = 'voice_disabled') {
    if (!server) return snapshot();
    emit('bridge', { message: 'Voice bridge closed.', reason });
    for (const client of clients) client.end();
    clients.clear();
    await new Promise((resolve) => server.close(() => resolve()));
    onEvent({ type: 'voice_bridge_stopped', at: new Date().toISOString(), reason, ...snapshot() });
    server = null;
    address = null;
    return snapshot();
  }

  function browserUrl() {
    if (!address) return null;
    return `http://${host}:${address.port}/voice?token=${encodeURIComponent(token)}`;
  }

  function open() {
    const url = browserUrl();
    if (!url) throw new Error('voice bridge is not running');
    return { ...safeOpenBrowser(url, { spawnImpl }), url };
  }

  function publishTutor({
    text,
    turn = null,
    turnId = null,
    register = null,
    character = null,
    reason = 'accepted_tutor_text',
  }) {
    const approved = nonEmptyString(text, 'approved tutor text');
    deliverySequence += 1;
    latestTutor = {
      schema: 'machinespirits.tutor-stub.voice-delivery.v1',
      deliveryId: `${runId || 'voice'}:voice:${String(deliverySequence).padStart(4, '0')}`,
      text: approved,
      turn,
      turnId,
      register,
      character,
      reason,
      acceptedAt: new Date().toISOString(),
    };
    tutorDeliveries.set(latestTutor.deliveryId, latestTutor);
    while (tutorDeliveries.size > 64) tutorDeliveries.delete(tutorDeliveries.keys().next().value);
    emit('tutor', latestTutor);
    return latestTutor;
  }

  return {
    schema: TUTOR_STUB_VOICE_BRIDGE_SCHEMA,
    session,
    start,
    stop,
    open,
    snapshot,
    browserUrl,
    publishTutor,
    publishStatus(message, detail = {}) {
      return emit('bridge', { message: nonEmptyString(message, 'voice status'), ...detail });
    },
  };
}
