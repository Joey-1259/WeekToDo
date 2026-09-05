import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const BACKUP_REVISION = 1;
const MARKER_FILE = `.modernization-backup-v${BACKUP_REVISION}.json`;

const DATA_ENTRIES = [
  "Local Storage",
  "IndexedDB",
  "Session Storage",
  "config.json",
  "Preferences",
  "Local State",
];

function copyEntry(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }

  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    fs.cpSync(source, destination, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  } else {
    fs.mkdirSync(path.dirname(destination), {
      recursive: true,
    });

    fs.copyFileSync(
      source,
      destination,
      fs.constants.COPYFILE_EXCL
    );
  }

  return true;
}

export function ensurePreModernizationBackup() {
  const userDataPath = app.getPath("userData");
  const markerPath = path.join(userDataPath, MARKER_FILE);

  if (fs.existsSync(markerPath)) {
    return {
      created: false,
      userDataPath,
      reason: "backup-already-exists",
    };
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupRoot = path.join(
    userDataPath,
    "data-backups",
    `pre-modernization-v${BACKUP_REVISION}-${timestamp}`
  );

  const copiedEntries = [];

  try {
    fs.mkdirSync(backupRoot, {
      recursive: true,
    });

    DATA_ENTRIES.forEach((entryName) => {
      const source = path.join(
        userDataPath,
        entryName
      );

      const destination = path.join(
        backupRoot,
        entryName
      );

      if (copyEntry(source, destination)) {
        copiedEntries.push(entryName);
      }
    });

    const manifest = {
      backupRevision: BACKUP_REVISION,
      appName: app.getName(),
      appVersion: app.getVersion(),
      createdAt: new Date().toISOString(),
      userDataPath,
      backupRoot,
      copiedEntries,
    };

    fs.writeFileSync(
      path.join(backupRoot, "backup-manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    fs.writeFileSync(
      markerPath,
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    console.info(
      "[dataBackup] 旧版用户数据已备份：",
      backupRoot
    );

    return {
      created: true,
      ...manifest,
    };
  } catch (error) {
    console.error(
      "[dataBackup] 自动备份失败，为避免覆盖风险将终止启动：",
      error
    );

    throw new Error(
      `无法备份 WeekToDo 用户数据。应用已停止启动，原数据未被删除。\n${error.message}`
    );
  }
}
