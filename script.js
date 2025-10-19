/* All-in-one frontend logic:
   - encoding/decoding: base64, hex, url, xor, aes
   - hashing: md5, sha256 (one-way)
   - QR: generate image, decode from uploaded image
   - utilities: copy result, download result, dark theme
*/

// Helpers
const $ = id => document.getElementById(id);

function showResult(text) {
  $('result').innerText = text === null ? '' : text;
  // hide or show QR container depending on content
  $('qrcodeContainer').hidden = true;
  $('qrcode').innerHTML = '';
}

function encode() {
  const text = $('inputText').value || '';
  const method = $('method').value;
  const key = $('key').value || '';
  try {
    if (method === 'base64') {
      showResult(btoa(unicodeToUtf8(text)));
    } else if (method === 'hex') {
      showResult(Array.from(text).map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));
    } else if (method === 'url') {
      showResult(encodeURIComponent(text));
    } else if (method === 'xor') {
      if (!key) return alert('Enter XOR key (one character recommended).');
      let out = '';
      for (let i = 0; i < text.length; i++) out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      showResult(btoa(unicodeToUtf8(out)));
    } else if (method === 'aes') {
      if (!key) return alert('Enter AES password.');
      const cipher = CryptoJS.AES.encrypt(text, key).toString();
      showResult(cipher);
    } else if (method === 'md5') {
      showResult(CryptoJS.MD5(text).toString());
    } else if (method === 'sha256') {
      showResult(CryptoJS.SHA256(text).toString());
    } else if (method === 'qrgen') {
      if (!text) return alert('Enter text to generate QR code.');
      showResult('QR image generated below.');
      generateQRCode(text);
    } else {
      showResult('Unsupported method for encode.');
    }
  } catch (e) {
    showResult('Error: ' + e.message);
  }
}

function decode() {
  const text = $('inputText').value || '';
  const method = $('method').value;
  const key = $('key').value || '';
  try {
    if (method === 'base64') {
      showResult(utf8ToUnicode(atob(text)));
    } else if (method === 'hex') {
      if (!text) return showResult('');
      const bytes = text.match(/.{1,2}/g) || [];
      const s = bytes.map(h => String.fromCharCode(parseInt(h, 16))).join('');
      showResult(s);
    } else if (method === 'url') {
      showResult(decodeURIComponent(text));
    } else if (method === 'xor') {
      if (!key) return alert('Enter XOR key used during encode.');
      let decoded = utf8ToUnicode(atob(text));
      let out = '';
      for (let i = 0; i < decoded.length; i++) out += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      showResult(out);
    } else if (method === 'aes') {
      if (!key) return alert('Enter AES password.');
      try {
        const bytes = CryptoJS.AES.decrypt(text, key);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        if (!plaintext) showResult('Invalid password or corrupted cipher.');
        else showResult(plaintext);
      } catch {
        showResult('Invalid password or corrupted cipher.');
      }
    } else if (method === 'qrdecode') {
      // instruct user to upload image (or use file input)
      if ($('qrFile').files.length === 0) {
        return alert('Choose a QR image file using "Upload QR Image" button.');
      }
      // decoding will be handled by file onchange --> onQRFileSelected
      showResult('Select a QR image file to decode (Upload QR Image).');
    } else {
      showResult('❌ Hashes (MD5/SHA256) are one-way and cannot be decoded.');
    }
  } catch (e) {
    showResult('Error: ' + e.message);
  }
}

/* ---------- QR generate & decode ---------- */

function generateQRCode(text) {
  $('qrcodeContainer').hidden = false;
  $('qrcode').innerHTML = '';
  // create QR code - size adapts to container
  new QRCode($('qrcode'), {
    text: text,
    width: 240,
    height: 240,
    correctLevel: QRCode.CorrectLevel.H
  });
}

function onQRFileSelected(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  decodeQRFromFile(file).then(data => {
    if (data) {
      showResult(data);
      // switch method to show result
      $('method').value = 'qrdecode';
    } else {
      showResult('No QR code found in image.');
    }
  }).catch(err => showResult('Error decoding QR: ' + err.message));
}

async function decodeQRFromFile(file) {
  // read image into canvas and use jsQR
  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imgData.data, canvas.width, canvas.height);
  return code ? code.data : null;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Utilities: copy, download ---------- */

function copyResult() {
  const text = $('result').innerText || '';
  if (!text) return alert('Nothing to copy.');
  navigator.clipboard?.writeText(text).then(() => {
    alert('Copied to clipboard!');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); alert('Copied!'); } catch { alert('Copy failed'); }
    ta.remove();
  });
}

function downloadResult() {
  const text = $('result').innerText || '';
  if (!text) return alert('Nothing to download.');
  const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'result.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Theme toggle ---------- */

function toggleTheme() {
  document.body.classList.toggle('dark');
  const btn = $('themeToggle');
  btn.innerText = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

/* ---------- UTF8 helpers for safe base64 of unicode ---------- */

function unicodeToUtf8(str) {
  // convert JS string (utf-16) to UTF-8 bytes, then to string where each char is a byte
  return new TextEncoder().encode(str).reduce((s, b) => s + String.fromCharCode(b), '');
}
function utf8ToUnicode(str) {
  // convert string where each char is a byte to JS string
  const bytes = Uint8Array.from(Array.from(str).map(c => c.charCodeAt(0)));
  return new TextDecoder().decode(bytes);
}

/* Init */
showResult('');