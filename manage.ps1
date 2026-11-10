<#
.SYNOPSIS
    FileShare 本地环境运维脚本（pnpm workspace + 单文件 exe）。

.DESCRIPTION
    封装 fileshare-monorepo 的常用操作：安装依赖、开发、构建、打包 exe、
    启动/停止/重启服务、查看日志与状态、打开页面、清理上传文件。
    日志与上传目录默认位于 exe 同目录（apps/cmd/dist）或开发目录（apps/cmd）。

.PARAMETER Action
    要执行的操作，默认 status：
      install    安装依赖，并在缺失时从 .env.example 创建 apps/cmd/.env
      dev        开发模式（tsx watch，前台运行）
      build      workspace 构建（输出 apps/cmd/dist/main.cjs）
      exe        打包单文件 apps/cmd/dist/FileShare.exe（需 Node.js >= 25.7）
      start      后台启动 exe 并等待健康检查（-Foreground 则前台运行）
      stop       停止正在运行的 FileShare.exe
      restart    stop + start
      status     查看进程、健康检查、上传目录与日志状态
      logs       查看 logs/app.log 末尾内容（-Follow 持续跟踪）
      open       用浏览器打开本地首页与 API 文档
      reset      清空全部已上传文件（运行中时调用 API，否则直接删除）
      clean      清理构建产物（dist / .turbo / build）
      test       运行 Vitest
      lint       ESLint
      typecheck  TypeScript 类型检查
      format     Prettier 格式化

.PARAMETER Force
    reset 跳过二次确认。

.PARAMETER Follow
    logs 是否持续跟踪输出。

.PARAMETER Tail
    logs 显示的最后行数，默认 200。

.PARAMETER TimeoutSeconds
    start / restart 等待健康检查的超时秒数，默认 60。

.PARAMETER NoWait
    start / restart 启动后不等待健康检查。

.PARAMETER Foreground
    start 在当前终端前台运行（Ctrl+C 退出）。

.EXAMPLE
    pwsh ./manage.ps1 install

.EXAMPLE
    pwsh ./manage.ps1 dev

.EXAMPLE
    pwsh ./manage.ps1 exe

.EXAMPLE
    pwsh ./manage.ps1 start

.EXAMPLE
    pwsh ./manage.ps1 status

.EXAMPLE
    pwsh ./manage.ps1 logs -Follow -Tail 500

.EXAMPLE
    pwsh ./manage.ps1 reset

.EXAMPLE
    pwsh ./manage.ps1 test
#>
#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet(
        'install', 'dev', 'build', 'exe', 'start', 'stop', 'restart',
        'status', 'logs', 'open', 'reset', 'clean', 'test', 'lint', 'typecheck', 'format'
    )]
    [string]$Action = 'status',

    [switch]$Force,
    [switch]$Follow,

    [ValidateRange(1, 10000)]
    [int]$Tail = 200,

    [ValidateRange(5, 600)]
    [int]$TimeoutSeconds = 60,

    [switch]$NoWait,
    [switch]$Foreground
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 统一以 UTF-8 输出，避免中文在重定向/管道中乱码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptRoot = $PSScriptRoot
$MonorepoRoot = Join-Path $ScriptRoot 'fileshare-monorepo'
$AppDir = Join-Path $MonorepoRoot 'apps/cmd'
$DistDir = Join-Path $AppDir 'dist'
$ExePath = Join-Path $DistDir 'FileShare.exe'
$ProcessName = 'FileShare'

$ToolchainActions = @('install', 'dev', 'build', 'exe', 'test', 'lint', 'typecheck', 'format')

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Assert-Prerequisites {
    param([switch]$ForExe)

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw '未找到 node 命令，请先安装 Node.js（>= 22.12，打包 exe 需 >= 25.7）。'
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw '未找到 pnpm 命令，请先安装 pnpm（>= 9）。'
    }
    if (-not (Test-Path -LiteralPath $MonorepoRoot)) {
        throw "未找到 monorepo 目录：$MonorepoRoot"
    }

    $versionText = (& node -p 'process.versions.node') | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($versionText)) {
        throw '读取 Node.js 版本失败。'
    }

    $nodeVersion = [version]$versionText
    if ($nodeVersion -lt [version]'22.12.0') {
        throw "Node.js 版本过低（当前 $nodeVersion），需要 >= 22.12.0。"
    }
    if ($ForExe -and $nodeVersion -lt [version]'25.7.0') {
        throw "打包 exe 需要 Node.js >= 25.7.0（当前 $nodeVersion），请升级 Node.js。"
    }
}

function Invoke-Pnpm {
    param(
        [Parameter(Mandatory)]
        [string[]]$PnpmArgs
    )

    Push-Location $MonorepoRoot
    try {
        & pnpm @PnpmArgs
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm $($PnpmArgs -join ' ') 执行失败（退出码 $LASTEXITCODE）。"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-RunningProcess {
    $processes = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0) {
        return $null
    }
    return $processes[0]
}

function Get-Port {
    $envFiles = @(
        (Join-Path $DistDir '.env'),
        (Join-Path $DistDir '.env.local'),
        (Join-Path $AppDir '.env'),
        (Join-Path $AppDir '.env.local')
    )

    foreach ($file in $envFiles) {
        if (-not (Test-Path -LiteralPath $file)) {
            continue
        }

        foreach ($line in Get-Content -LiteralPath $file -Encoding utf8) {
            if ($line -match '^\s*PORT\s*=\s*(\d+)\s*(?:#.*)?$') {
                return [int]$Matches[1]
            }
        }
    }

    return 8000
}

function Test-Health {
    param([Parameter(Mandatory)][int]$Port)

    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2 -ErrorAction Stop
        return ($response.status -eq 'ok')
    }
    catch {
        return $false
    }
}

function Wait-Healthy {
    param([Parameter(Mandatory)][int]$Port)

    if ($NoWait) {
        Write-Host '已跳过健康检查等待。' -ForegroundColor DarkGray
        return
    }

    Write-Step "等待服务就绪（最长 ${TimeoutSeconds}s）..."
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        if (Test-Health -Port $Port) {
            Write-Ok "服务已就绪：http://127.0.0.1:$Port"
            return
        }
        Start-Sleep -Milliseconds 500
    }

    $logPath = Join-Path (Join-Path $DistDir 'logs') 'app.log'
    throw "等待服务就绪超时（${TimeoutSeconds}s），请检查：$logPath"
}

function Start-Server {
    if (-not (Test-Path -LiteralPath $ExePath)) {
        throw "未找到 $ExePath，请先执行：pwsh ./manage.ps1 exe"
    }

    if ($null -ne (Get-RunningProcess)) {
        Write-Warn '服务已在运行，如需重启请执行：pwsh ./manage.ps1 restart'
        return
    }

    $port = Get-Port

    if ($Foreground) {
        Write-Step '前台启动 exe（Ctrl+C 退出）...'
        & $ExePath
        return
    }

    Write-Step "后台启动 $ExePath ..."
    Start-Process -FilePath $ExePath -WorkingDirectory $DistDir | Out-Null
    Wait-Healthy -Port $port
}

function Stop-Server {
    $process = Get-RunningProcess
    if ($null -eq $process) {
        Write-Warn '服务未在运行。'
        return
    }

    Stop-Process -Id $process.Id -Force
    Write-Ok "已停止 FileShare.exe（PID $($process.Id)）。"
}

function Confirm-Destructive {
    param([Parameter(Mandatory)][string]$Message)

    if ($Force) {
        return
    }

    $answer = Read-Host "$Message 输入 YES 继续"
    if ($answer -ne 'YES') {
        Write-Warn '已取消。'
        exit 0
    }
}

function Get-ActiveUploadDir {
    $exeUploads = Join-Path $DistDir 'uploads'
    $devUploads = Join-Path $AppDir 'uploads'

    if ($null -ne (Get-RunningProcess) -and (Test-Path -LiteralPath $exeUploads)) {
        return $exeUploads
    }
    if (Test-Path -LiteralPath $exeUploads) {
        return $exeUploads
    }
    if (Test-Path -LiteralPath $devUploads) {
        return $devUploads
    }
    return $null
}

function Get-LogPath {
    $exeLog = Join-Path (Join-Path $DistDir 'logs') 'app.log'
    $devLog = Join-Path (Join-Path $AppDir 'logs') 'app.log'

    if (Test-Path -LiteralPath $exeLog) {
        return $exeLog
    }
    if (Test-Path -LiteralPath $devLog) {
        return $devLog
    }
    return $null
}

function Invoke-ClearUploads {
    param([Parameter(Mandatory)][string]$Directory)

    if (-not (Test-Path -LiteralPath $Directory)) {
        return 0
    }

    $count = 0
    foreach ($file in @(Get-ChildItem -LiteralPath $Directory -File -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $file.FullName -Force
        $count += 1
    }
    return $count
}

if ($ToolchainActions -contains $Action) {
    Assert-Prerequisites -ForExe:($Action -eq 'exe')
}

switch ($Action) {
    'install' {
        Invoke-Pnpm -PnpmArgs @('install')

        $envFile = Join-Path $AppDir '.env'
        $envExample = Join-Path $AppDir '.env.example'
        if (-not (Test-Path -LiteralPath $envFile) -and (Test-Path -LiteralPath $envExample)) {
            Copy-Item -LiteralPath $envExample -Destination $envFile
            Write-Ok "已创建 $envFile（可自行修改端口与上传目录）。"
        }
    }

    'dev' {
        Invoke-Pnpm -PnpmArgs @('dev')
    }

    'build' {
        Invoke-Pnpm -PnpmArgs @('build')
    }

    'exe' {
        Invoke-Pnpm -PnpmArgs @('exe')

        if (Test-Path -LiteralPath $ExePath) {
            $sizeMb = (Get-Item -LiteralPath $ExePath).Length / 1MB
            Write-Ok ("已生成 {0}（{1:N1} MB）" -f $ExePath, $sizeMb)
        }
    }

    'start' {
        Start-Server
    }

    'stop' {
        Stop-Server
    }

    'restart' {
        Stop-Server
        Start-Server
    }

    'status' {
        $port = Get-Port

        $process = Get-RunningProcess
        if ($null -eq $process) {
            Write-Warn '进程状态：未运行'
        }
        else {
            $startTime = '未知'
            try {
                $startTime = $process.StartTime.ToString('yyyy-MM-dd HH:mm:ss')
            }
            catch {
                # 进程可能刚好退出，保持“未知”
            }
            Write-Ok "进程状态：运行中（PID $($process.Id)，启动于 $startTime）"
        }

        if (Test-Health -Port $port) {
            Write-Ok "健康检查：正常（http://127.0.0.1:$port/health）"
        }
        else {
            Write-Warn '健康检查：无响应'
        }

        $uploadDir = Get-ActiveUploadDir
        if ($null -eq $uploadDir) {
            Write-Host '上传目录：尚未创建' -ForegroundColor DarkGray
        }
        else {
            $files = @(Get-ChildItem -LiteralPath $uploadDir -File -ErrorAction SilentlyContinue)
            $totalBytes = 0
            if ($files.Count -gt 0) {
                $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
            }
            Write-Host ("上传目录：{0}（{1} 个文件，{2:N1} MB）" -f $uploadDir, $files.Count, ($totalBytes / 1MB))
        }

        $logPath = Get-LogPath
        if ($null -eq $logPath) {
            Write-Host '日志文件：尚未创建' -ForegroundColor DarkGray
        }
        else {
            $logSizeMb = (Get-Item -LiteralPath $logPath).Length / 1MB
            Write-Host ("日志文件：{0}（{1:N1} MB）" -f $logPath, $logSizeMb)
        }

        Write-Host "首页：http://127.0.0.1:$port/    文档：http://127.0.0.1:$port/api/docs" -ForegroundColor DarkGray
    }

    'logs' {
        $logPath = Get-LogPath
        if ($null -eq $logPath) {
            throw '未找到日志文件，请先启动服务或执行 exe。'
        }

        Write-Step "日志文件：$logPath"
        if ($Follow) {
            Get-Content -LiteralPath $logPath -Tail $Tail -Wait
        }
        else {
            Get-Content -LiteralPath $logPath -Tail $Tail
        }
    }

    'open' {
        $port = Get-Port
        Write-Step "打开 http://127.0.0.1:$port/"
        Start-Process "http://127.0.0.1:$port/"
    }

    'reset' {
        Confirm-Destructive -Message '将清空所有已上传文件。'

        $port = Get-Port
        $cleared = $false
        if ($null -ne (Get-RunningProcess)) {
            try {
                $response = Invoke-RestMethod -Method Delete -Uri "http://127.0.0.1:$port/api/v1/files" -TimeoutSec 10 -ErrorAction Stop
                Write-Ok "已通过运行中的服务清空上传文件（$($response.count) 个）。"
                $cleared = $true
            }
            catch {
                Write-Warn '调用运行中的服务失败，将直接删除 uploads 目录内容。'
            }
        }

        if (-not $cleared) {
            $total = 0
            foreach ($directory in @((Join-Path $DistDir 'uploads'), (Join-Path $AppDir 'uploads'))) {
                $total += Invoke-ClearUploads -Directory $directory
            }
            Write-Ok "已清空上传文件（$total 个）。"
        }
    }

    'clean' {
        if ($null -ne (Get-RunningProcess)) {
            throw '服务正在运行，请先执行：pwsh ./manage.ps1 stop'
        }

        Invoke-Pnpm -PnpmArgs @('clean')
        Write-Ok '已清理构建产物（dist / .turbo / build）。'
    }

    'test' {
        Invoke-Pnpm -PnpmArgs @('test')
    }

    'lint' {
        Invoke-Pnpm -PnpmArgs @('lint')
    }

    'typecheck' {
        Invoke-Pnpm -PnpmArgs @('typecheck')
    }

    'format' {
        Invoke-Pnpm -PnpmArgs @('format')
    }
}
