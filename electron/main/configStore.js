import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

let storeCache = null;

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readStore() {
  if (storeCache) {
    return storeCache;
  }

  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      storeCache = {};
      return storeCache;
    }

    const content = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(content);

    storeCache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};

    return storeCache;
  } catch (error) {
    console.error(
      "[mainConfig] 读取旧版 config.json 失败：",
      error
    );

    // 不删除损坏文件，避免发生不可逆的数据丢失。
    storeCache = {};
    return storeCache;
  }
}

function writeStore(store) {
  const configPath = getConfigPath();
  const directory = path.dirname(configPath);
  const temporaryPath = `${configPath}.tmp`;

  fs.mkdirSync(directory, {
    recursive: true,
  });

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(store, null, 2),
    "utf8"
  );

  fs.renameSync(temporaryPath, configPath);
}

export default {
  get(key, fallbackValue) {
    const store = readStore();

    if (Object.prototype.hasOwnProperty.call(store, key)) {
      return store[key];
    }

    return fallbackValue;
  },

  set(key, value) {
    const store = readStore();
    store[key] = value;
    writeStore(store);
  },

  has(key) {
    const store = readStore();

    return Object.prototype.hasOwnProperty.call(
      store,
      key
    );
  },

  getAll() {
    return {
      ...readStore(),
    };
  },

  getPath() {
    return getConfigPath();
  },
};
