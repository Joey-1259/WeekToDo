const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist_electron')

if (!fs.existsSync(distDir)) {
  process.exit(0)
}

const currentUser = execSync('whoami', { encoding: 'utf-8' }).trim()

// 检查 dist_electron 下是否存在非当前用户所有的文件
try {
  const foreignFiles = execSync(
    `find "${distDir}" ! -user ${currentUser} 2>/dev/null`,
    { encoding: 'utf-8' }
  ).trim()

  if (foreignFiles) {
    console.log(`⚠ 检测到 dist_electron 中存在非 ${currentUser} 所有的文件，正在修复...`)
    try {
      // 先尝试普通 chown（如果当前用户在 admin 组可能就够了）
      execSync(`chown -R ${currentUser}:staff "${distDir}" 2>/dev/null`, { stdio: 'ignore' })
    } catch (_) {
      // 普通权限不够，用 sudo
      console.log('  → 需要 sudo 权限来修复文件所有权')
      execSync(`sudo chown -R ${currentUser}:staff "${distDir}"`, { stdio: 'inherit' })
    }
    console.log('✓ 文件所有权已修复')
  }
} catch (_) {
  // find 没有输出 = 所有文件都属于当前用户，无需处理
}

// 清除可能存在的 macOS 扩展属性
try {
  execSync(`xattr -cr "${distDir}" 2>/dev/null`, { stdio: 'ignore' })
} catch (_) {}

console.log('✓ pre-build 检查完成')
