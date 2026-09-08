const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function electronDirectory() {
  const packagePath = require.resolve(
    "electron/package.json"
  );

  return path.dirname(packagePath);
}

function expectedExecutable(directory) {
  const pathFile = path.join(
    directory,
    "path.txt"
  );

  if (!fs.existsSync(pathFile)) {
    return null;
  }

  const relativePath = fs
    .readFileSync(pathFile, "utf8")
    .trim();

  if (!relativePath) {
    return null;
  }

  return path.join(
    directory,
    "dist",
    relativePath
  );
}

function validInstallation(directory) {
  const executable =
    expectedExecutable(directory);

  return Boolean(
    executable &&
    fs.existsSync(executable)
  );
}

function installElectron(directory) {
  const installScript = path.join(
    directory,
    "install.js"
  );

  if (!fs.existsSync(installScript)) {
    throw new Error(
      `找不到 Electron 安装脚本：${installScript}`
    );
  }

  console.log(
    "[electron] Electron 二进制缺失，正在重新下载……"
  );

  const environment = {
    ...process.env,

    // 强制绕过可能损坏的 Electron 下载缓存。
    force_no_cache: "true",

    // 明确使用当前 Node 运行架构。
    ELECTRON_INSTALL_ARCH: process.arch,
    ELECTRON_INSTALL_PLATFORM: process.platform,
  };

  // 有些终端配置过跳过下载变量；
  // 自动修复时必须将其移除。
  delete environment.ELECTRON_SKIP_BINARY_DOWNLOAD;
  delete environment.npm_config_ignore_scripts;

  const result = spawnSync(
    process.execPath,
    [installScript],
    {
      cwd: directory,
      env: environment,
      stdio: "inherit",
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Electron 二进制安装失败，退出码：${result.status}`
    );
  }
}

function verifyArchitecture(executable) {
  if (process.platform !== "darwin") {
    return;
  }

  const result = spawnSync(
    "file",
    [executable],
    {
      encoding: "utf8",
    }
  );

  if (result.status === 0) {
    console.log(
      `[electron] ${result.stdout.trim()}`
    );
  }
}

function main() {
  let directory;

  try {
    directory = electronDirectory();
  } catch (error) {
    console.error(
      "[electron] Electron npm 包不存在。"
    );
    console.error(error);
    process.exit(1);
  }

  if (!validInstallation(directory)) {
    // 只删除二进制区域，不删除整个 node_modules，
    // 避免重新安装所有项目依赖。
    fs.rmSync(
      path.join(directory, "dist"),
      {
        recursive: true,
        force: true,
      }
    );

    fs.rmSync(
      path.join(directory, "path.txt"),
      {
        force: true,
      }
    );

    installElectron(directory);
  }

  if (!validInstallation(directory)) {
    console.error(
      "[electron] 安装脚本完成，但可执行文件仍不存在。"
    );
    process.exit(1);
  }

  const executable =
    expectedExecutable(directory);

  console.log(
    `[electron] 可执行文件已就绪：${executable}`
  );

  verifyArchitecture(executable);
}

try {
  main();
} catch (error) {
  console.error(
    "[electron] 自动修复失败："
  );
  console.error(
    error?.stack || error
  );
  process.exit(1);
}
