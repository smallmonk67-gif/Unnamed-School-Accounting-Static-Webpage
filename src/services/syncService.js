import { dbService } from './dbService';
import { driveService } from './driveService';

class SyncService {
  // Check if today is a new day and see if Google Drive has a newer version
  async checkDailyFreshness() {
    const today = new Date().toISOString().split('T')[0];
    const lastCheckDate = localStorage.getItem('last_drive_check_date');

    // Only auto-check once per day if client ID is configured
    if (lastCheckDate === today) {
      return { checked: false, reason: 'Already checked today' };
    }

    if (!driveService.getClientId()) {
      return { checked: false, reason: 'No Google Client ID' };
    }

    if (!driveService.isConnected()) {
      return { checked: false, reason: 'Google Drive not connected yet in this session' };
    }

    try {
      // Find remote file
      const remoteFile = await driveService.findDatabaseFile(false);
      localStorage.setItem('last_drive_check_date', today);

      if (!remoteFile) {
        return { checked: true, remoteFound: false };
      }

      const remoteModified = new Date(remoteFile.modifiedTime).getTime();
      const lastLocalSync = Number(localStorage.getItem('last_synced_timestamp') || 0);
      const lastLocalSave = new Date(await dbService.getSetting('last_local_save', 0)).getTime();

      // If remote is strictly newer than our last synced time AND our local save time
      if (remoteModified > lastLocalSync && remoteModified > (lastLocalSave + 2000)) {
        return {
          checked: true,
          shouldPrompt: true,
          remoteFile,
          remoteTime: remoteFile.modifiedTime,
          localTime: new Date(Math.max(lastLocalSync, lastLocalSave)).toISOString()
        };
      }

      return { checked: true, shouldPrompt: false };
    } catch (err) {
      console.warn('[Sync] Daily check error:', err);
      return { checked: true, error: err.message };
    }
  }

  // Pull remote and replace local database directly
  async pullRemoteReplaceLocal() {
    console.log('[Sync] Pulling remote database from Google Drive...');
    const remoteFile = await driveService.findDatabaseFile(true);
    if (!remoteFile) {
      throw new Error('ACCDB.sqlite was not found on your Google Drive.');
    }

    const remoteBytes = await driveService.downloadFile(remoteFile.id, true);
    console.log(`[Sync] Downloaded ${remoteBytes.byteLength} bytes. Restoring into local SQLite...`);
    await dbService.importBinary(remoteBytes);

    const remoteTime = new Date(remoteFile.modifiedTime).getTime();
    localStorage.setItem('last_synced_timestamp', String(remoteTime));
    localStorage.setItem('last_synced_iso', remoteFile.modifiedTime);
    localStorage.setItem('last_drive_file_id', remoteFile.id);

    console.log('[Sync] Pull & Replace completed successfully!');
    return { file: remoteFile, size: remoteBytes.byteLength };
  }

  // Save to OPFS + Sync to Google Drive
  async saveAndSync() {
    console.log('[Sync] Step 1/3: Saving local database to browser OPFS...');
    // 1. Flush local to OPFS
    await dbService.saveToOPFS();
    const localBinary = await dbService.exportBinary();
    console.log(`[Sync] Step 1/3 Complete: Saved to OPFS (${localBinary.byteLength} bytes).`);

    console.log('[Sync] Step 2/3: Checking Google Drive for existing database file...');
    // 2. Find remote file
    const remoteFile = await driveService.findDatabaseFile(true);

    if (!remoteFile) {
      // Remote doesn't exist yet -> First time upload!
      console.log('[Sync] Step 3/3: Remote database not found. Creating and uploading initial ACCDB.sqlite to Google Drive...');
      const uploadRes = await driveService.uploadFile(localBinary, null, true);
      const modTime = new Date(uploadRes.modifiedTime).getTime();
      localStorage.setItem('last_synced_timestamp', String(modTime));
      localStorage.setItem('last_synced_iso', uploadRes.modifiedTime);
      localStorage.setItem('last_drive_file_id', uploadRes.id);
      console.log('[Sync] Initial upload complete!');
      return { status: 'created_and_uploaded', file: uploadRes };
    }

    const remoteModified = new Date(remoteFile.modifiedTime).getTime();
    const lastSyncedTimestamp = Number(localStorage.getItem('last_synced_timestamp') || 0);

    // 3. Conflict detection:
    // If remote has been modified since we last synced (remoteModified > lastSyncedTimestamp + 2000)
    if (lastSyncedTimestamp > 0 && remoteModified > (lastSyncedTimestamp + 2000)) {
      console.warn('[Sync] Conflict detected: Remote file on Google Drive is newer than local last sync timestamp.');
      // Remote was edited by another device/session!
      const remoteBytes = await driveService.downloadFile(remoteFile.id, true);
      return {
        status: 'conflict',
        remoteFile,
        remoteBytes,
        remoteTime: remoteFile.modifiedTime,
        lastSyncedTime: new Date(lastSyncedTimestamp).toISOString()
      };
    }

    // 4. No conflict -> Upload update to Drive
    console.log(`[Sync] Step 3/3: Updating existing file on Google Drive (ID: ${remoteFile.id})...`);
    const updateRes = await driveService.uploadFile(localBinary, remoteFile.id, true);
    const newModTime = new Date(updateRes.modifiedTime).getTime();
    localStorage.setItem('last_synced_timestamp', String(newModTime));
    localStorage.setItem('last_synced_iso', updateRes.modifiedTime);
    localStorage.setItem('last_drive_file_id', updateRes.id);

    console.log('[Sync] Synchronization to Google Drive completed successfully!');
    return { status: 'synced', file: updateRes };
  }

  // Resolve conflict: Best Effort Merge
  async resolveMerge(remoteBytes, remoteFileId) {
    // Execute SQLite ATTACH merge
    const mergeRes = await dbService.mergeRemote(remoteBytes);

    // Upload merged result to Google Drive
    const mergedBinary = await dbService.exportBinary();
    const updateRes = await driveService.uploadFile(mergedBinary, remoteFileId);

    const modTime = new Date(updateRes.modifiedTime).getTime();
    localStorage.setItem('last_synced_timestamp', String(modTime));
    localStorage.setItem('last_synced_iso', updateRes.modifiedTime);
    localStorage.setItem('last_drive_file_id', updateRes.id);

    return { success: true, mergeStats: mergeRes.stats, file: updateRes };
  }

  // Resolve conflict: Force Overwrite Remote with Local
  async resolveForceOverwrite(remoteFileId) {
    const localBinary = await dbService.exportBinary();
    const updateRes = await driveService.uploadFile(localBinary, remoteFileId);

    const modTime = new Date(updateRes.modifiedTime).getTime();
    localStorage.setItem('last_synced_timestamp', String(modTime));
    localStorage.setItem('last_synced_iso', updateRes.modifiedTime);
    localStorage.setItem('last_drive_file_id', updateRes.id);

    return { success: true, file: updateRes };
  }

  // Resolve conflict: Discard Local, Keep Remote
  async resolveKeepRemote(remoteBytes, remoteFile) {
    await dbService.importBinary(remoteBytes);

    const modTime = new Date(remoteFile.modifiedTime).getTime();
    localStorage.setItem('last_synced_timestamp', String(modTime));
    localStorage.setItem('last_synced_iso', remoteFile.modifiedTime);
    localStorage.setItem('last_drive_file_id', remoteFile.id);

    return { success: true, file: remoteFile };
  }
}

export const syncService = new SyncService();
