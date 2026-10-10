const DRIVE_FILE_NAME = 'ACCDB.sqlite';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Obfuscated default Google OAuth Client ID
const DEFAULT_CLIENT_ID_ENC = 'MzQxMTUxNzY2MjM5LW5sYmZxcm5hanZicG85MmtnYWxpcm40cDdiMTgwY3NiLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t';

function decodeKey(enc) {
  try {
    return atob(enc);
  } catch {
    return '';
  }
}

class DriveService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.authPromise = null;
  }

  getClientId() {
    // Check obfuscated/encrypted storage first
    const enc = localStorage.getItem('gdrive_client_id_enc');
    if (enc) {
      const decoded = decodeKey(enc);
      if (decoded) return decoded;
    }
    // Fallback to legacy plaintext
    const custom = localStorage.getItem('gdrive_client_id');
    if (custom) return custom;
    // Fallback to preconfigured project client ID
    return decodeKey(DEFAULT_CLIENT_ID_ENC);
  }

  setClientId(clientId) {
    const val = (clientId || '').trim();
    if (val) {
      localStorage.setItem('gdrive_client_id_enc', btoa(val));
      localStorage.removeItem('gdrive_client_id'); // purge plaintext
    } else {
      localStorage.removeItem('gdrive_client_id_enc');
      localStorage.removeItem('gdrive_client_id');
    }
    this.tokenClient = null;
    this.accessToken = null;
    this.authPromise = null;
  }

  isConnected() {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  // Request OAuth access token using Google Identity Services (GIS)
  async authenticate(promptUser = true) {
    if (this.isConnected()) {
      return this.accessToken;
    }

    // Reuse existing in-flight authentication request to avoid duplicate popups or dropped callbacks
    if (this.authPromise) {
      console.log('[Google Drive] Authentication already in progress, reusing existing promise...');
      return this.authPromise;
    }

    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('Google OAuth Client ID is not configured. Please enter your Client ID in the Sync & Backup tab.');
    }

    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
      throw new Error('Google Identity Services SDK is not loaded. Please verify your internet connection.');
    }

    this.authPromise = new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = null;

      const finish = (fn) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        this.authPromise = null;
        fn();
      };

      const requestStartTime = Date.now();

      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (tokenResponse) => {
            finish(() => {
              if (tokenResponse?.error) {
                console.error('[Google Drive] GIS Callback Error:', tokenResponse);
                reject(new Error(`Google Authentication failed: ${tokenResponse.error_description || tokenResponse.error}`));
                return;
              }
              if (!tokenResponse || !tokenResponse.access_token) {
                console.error('[Google Drive] Incomplete token response:', tokenResponse);
                reject(new Error('Google Authentication completed without returning an access token. Please select an account and grant permission.'));
                return;
              }
              console.log('[Google Drive] Successfully received OAuth access token!');
              this.accessToken = tokenResponse.access_token;
              const expiresIn = Number(tokenResponse.expires_in) || 3500;
              this.tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
              resolve(this.accessToken);
            });
          },
          error_callback: (nonOAuthError) => {
            const elapsed = Date.now() - requestStartTime;
            console.warn(`[Google Drive] GIS Non-OAuth event (${elapsed}ms):`, nonOAuthError);
            const type = nonOAuthError?.type || '';
            const message = nonOAuthError?.message || '';

            // Suppress premature popup_closed events within first 5 seconds
            // This occurs when COOP header severs the opener check in Chromium before user interaction
            if ((type === 'popup_closed' || message.includes('popup_closed')) && elapsed < 5000) {
              console.warn('[Google Drive] Suppressed premature popup_closed event (COOP polling artifact). Waiting for user selection in popup...');
              return;
            }

            finish(() => {
              if (type === 'popup_closed' || message.includes('popup_closed')) {
                reject(new Error('Google sign-in popup was closed before completing authorization.'));
              } else if (type === 'popup_blocked' || message.includes('popup_blocked')) {
                reject(new Error('Browser blocked the Google sign-in popup. Please allow popups for this site in the address bar.'));
              } else {
                reject(new Error(`Google sign-in error: ${message || type || 'Failed to authenticate'}`));
              }
            });
          }
        });

        // 60-second timeout so "Syncing..." never hangs indefinitely
        timeoutId = setTimeout(() => {
          finish(() => {
            reject(new Error('Google authorization timed out (60s). Check if your browser blocked popups or if the sign-in window opened in the background.'));
          });
        }, 60000);

        const promptMode = promptUser ? 'select_account' : '';
        console.log(`[Google Drive] Requesting access token with prompt='${promptMode}'...`);
        this.tokenClient.requestAccessToken({ prompt: promptMode });
      } catch (err) {
        finish(() => reject(err));
      }
    });
  }

  // Find ACCDB.sqlite on user's Google Drive
  async findDatabaseFile(interactive = true) {
    const token = await this.authenticate(interactive);
    if (!token) {
      throw new Error('Google Drive access token is missing. Please connect Google Drive first.');
    }

    console.log(`[Google Drive] Searching for '${DRIVE_FILE_NAME}'...`);
    const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const fields = encodeURIComponent('files(id, name, modifiedTime, size, md5Checksum)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&spaces=drive`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      throw new Error('Google Drive access token expired or invalid (401). Please click "Connect Google Drive" to re-authorize.');
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Google Drive] Search error:', res.status, errText);
      throw new Error(formatGoogleApiError(res.status, errText));
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      data.files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
      console.log(`[Google Drive] Found remote file: ${data.files[0].name} (ID: ${data.files[0].id}, modified: ${data.files[0].modifiedTime})`);
      return data.files[0];
    }
    console.log('[Google Drive] No existing database file found on Drive.');
    return null;
  }

  // Download ACCDB.sqlite binary from Google Drive
  async downloadFile(fileId, interactive = true) {
    const token = await this.authenticate(interactive);
    if (!token) {
      throw new Error('Google Drive access token is missing. Please connect Google Drive first.');
    }

    console.log(`[Google Drive] Downloading file ID: ${fileId}...`);
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      throw new Error('Google Drive access token expired or invalid (401). Please click "Connect Google Drive" to re-authorize.');
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(formatGoogleApiError(res.status, errText));
    }

    const buffer = await res.arrayBuffer();
    console.log(`[Google Drive] Downloaded ${buffer.byteLength} bytes.`);
    return new Uint8Array(buffer);
  }

  // Upload or Update ACCDB.sqlite on Google Drive
  async uploadFile(uint8Array, existingFileId = null, interactive = true) {
    const token = await this.authenticate(interactive);
    if (!token) {
      throw new Error('Google Drive access token is missing. Please connect Google Drive first.');
    }

    console.log(`[Google Drive] Uploading ${uint8Array.byteLength} bytes (${existingFileId ? 'updating existing' : 'creating new'})...`);
    const blob = new Blob([uint8Array], { type: 'application/x-sqlite3' });

    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: 'application/x-sqlite3',
      description: 'Music School Accounting Database (ACCDB.sqlite)'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    let url;
    let method;

    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size`;
      method = 'PATCH';
    } else {
      url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size`;
      method = 'POST';
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    });

    if (res.status === 401) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      throw new Error('Google Drive access token expired or invalid (401). Please click "Connect Google Drive" to re-authorize.');
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Google Drive] Upload error:', res.status, errText);
      throw new Error(formatGoogleApiError(res.status, errText));
    }

    const data = await res.json();
    console.log('[Google Drive] Upload success:', data);
    return data;
  }
}

function formatGoogleApiError(status, errText) {
  try {
    const json = JSON.parse(errText);
    const msg = json.error?.message || '';
    if (msg.includes('Google Drive API has not been used in project') || msg.includes('it is disabled')) {
      return 'Google Drive API is disabled in your Google Cloud Project. Please click the link to enable it: https://console.developers.google.com/apis/api/drive.googleapis.com/overview';
    }
    return `Google Drive API error (${status}): ${msg || errText}`;
  } catch {
    return `Google Drive error (${status}): ${errText}`;
  }
}

export const driveService = new DriveService();
