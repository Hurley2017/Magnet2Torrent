# Magnet2Torrent CLI Windows Installer (PowerShell iex)
# Usage: irm https://raw.githubusercontent.com/Hurley2017/Magnet2Torrent/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
    # Ignore if platform defaults already enforce TLS 1.2+
}

$RepoOwner = 'Hurley2017'
$RepoName = 'Magnet2Torrent'
$Branch = 'main'
$ArchiveUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Branch.zip"

$InstallRoot = Join-Path $env:LOCALAPPDATA 'Magnet2Torrent'
$AppDir = Join-Path $InstallRoot 'app'
$BinDir = Join-Path $InstallRoot 'bin'
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("m2t-install-" + [Guid]::NewGuid().ToString('N'))

Write-Host ''
Write-Host '  ==================================================================' -ForegroundColor Cyan
Write-Host '                    Magnet2Torrent CLI Installer                    ' -ForegroundColor Cyan
Write-Host '  ==================================================================' -ForegroundColor Cyan
Write-Host '  [!] ADVISORY: Intended strictly for legal, open-source, and' -ForegroundColor Yellow
Write-Host '      public-domain P2P file distribution. Do NOT use for piracy.' -ForegroundColor Yellow
Write-Host ''

function Refresh-SessionPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @()
    if ($machinePath) { $parts += $machinePath.Split(';') }
    if ($userPath) { $parts += $userPath.Split(';') }
    $env:Path = ($parts | Where-Object { $_ -and $_.Trim() -ne '' } | Select-Object -Unique) -join ';'
}

function Get-NodeMajorVersion {
    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    }
    if (-not $nodeCmd) { return $null }
    try {
        $raw = (& $nodeCmd.Source -p "process.versions.node.split('.')[0]" 2>$null).Trim()
        return [int]$raw
    } catch {
        return $null
    }
}

$nodeMajor = Get-NodeMajorVersion
if (-not $nodeMajor -or $nodeMajor -lt 22) {
    Write-Host '[*] Node.js >= 22 is required. Checking winget to install OpenJS.NodeJS.LTS...' -ForegroundColor Cyan
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
        & $winget.Source install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Refresh-SessionPath
        $nodeMajor = Get-NodeMajorVersion
    }
    if (-not $nodeMajor -or $nodeMajor -lt 22) {
        throw 'Node.js >= 22 was not found. Install Node.js LTS from https://nodejs.org/ and re-run this installer.'
    }
}
Write-Host "[+] Node.js v$nodeMajor detected." -ForegroundColor Green

try {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    $ZipPath = Join-Path $TempDir 'repo.zip'
    $ExtractDir = Join-Path $TempDir 'extracted'

    Write-Host "[*] Downloading Magnet2Torrent CLI from GitHub ($Branch)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ZipPath -UseBasicParsing

    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force
    $SourceRoot = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1
    if (-not $SourceRoot) {
        throw 'Downloaded archive was empty or could not be extracted.'
    }

    if (Test-Path $AppDir) {
        $ExistingModules = Join-Path $AppDir 'node_modules'
        $BackupModules = Join-Path $TempDir 'node_modules_backup'
        if (Test-Path $ExistingModules) {
            Move-Item -Path $ExistingModules -Destination $BackupModules -Force
        }
        Remove-Item -Path $AppDir -Recurse -Force
        New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
        if (Test-Path $BackupModules) {
            Move-Item -Path $BackupModules -Destination (Join-Path $AppDir 'node_modules') -Force
        }
    } else {
        New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
    }

    $CliFiles = @('package.json', 'package-lock.json', 'index.js', 'launch.bat', 'magnet.ico', 'README.md', 'DISCLAIMER.md', 'LICENSE')
    foreach ($file in $CliFiles) {
        $src = Join-Path $SourceRoot.FullName $file
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination (Join-Path $AppDir $file) -Force
        }
    }
    $LibSrc = Join-Path $SourceRoot.FullName 'lib'
    if (Test-Path $LibSrc) {
        Copy-Item -Path $LibSrc -Destination (Join-Path $AppDir 'lib') -Recurse -Force
    }

    $NpmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $NpmCmd) {
        $NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
    }
    if (-not $NpmCmd) {
        throw 'npm was not found alongside Node.js. Please repair your Node.js installation.'
    }

    Write-Host '[*] Installing CLI dependencies (including local VLC streaming engine)...' -ForegroundColor Cyan
    Push-Location $AppDir
    try {
        & $NpmCmd.Source install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    $ShimPath = Join-Path $BinDir 'magnet2torrent.cmd'
    $ShimContent = "@echo off`r`nnode `"$AppDir\index.js`" %*`r`n"
    Set-Content -Path $ShimPath -Value $ShimContent -Encoding Ascii -Force

    # Persist User PATH without duplication and expose immediately in current shell
    $currentUserPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $userEntries = @()
    if ($currentUserPath) {
        $userEntries = $currentUserPath.Split(';') | Where-Object { $_ -and $_.Trim() -ne '' }
    }
    if (-not ($userEntries -contains $BinDir)) {
        $newUserPath = (@($userEntries) + @($BinDir)) -join ';'
        [System.Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
        Write-Host "[+] Added $BinDir to User PATH." -ForegroundColor Green
    }
    $sessionEntries = ($env:Path -split ';') | Where-Object { $_ -and $_.Trim() -ne '' }
    if (-not ($sessionEntries -contains $BinDir)) {
        $env:Path = "$BinDir;$env:Path"
    }

    $vlcPaths = @()
    if ($env:ProgramFiles) {
        $vlcPaths += (Join-Path $env:ProgramFiles 'VideoLAN\VLC\vlc.exe')
    }
    if (${env:ProgramFiles(x86)}) {
        $vlcPaths += (Join-Path ${env:ProgramFiles(x86)} 'VideoLAN\VLC\vlc.exe')
    }
    if ($env:LOCALAPPDATA) {
        $vlcPaths += (Join-Path $env:LOCALAPPDATA 'Programs\VideoLAN\VLC\vlc.exe')
    }
    $vlcFound = ($vlcPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1)
    if (-not $vlcFound) {
        $vlcCmd = Get-Command vlc -ErrorAction SilentlyContinue
        if ($vlcCmd) { $vlcFound = $vlcCmd.Source }
    }

    Write-Host ''
    Write-Host '[+] Magnet2Torrent CLI installed successfully!' -ForegroundColor Green
    Write-Host "    Location: $AppDir" -ForegroundColor Gray
    if ($vlcFound) {
        Write-Host "    VLC:      Detected ($vlcFound)" -ForegroundColor Gray
    } else {
        Write-Host '    VLC:      Not detected yet (optional for --vlc playback).' -ForegroundColor Yellow
        Write-Host '              Install with: winget install VideoLAN.VLC' -ForegroundColor Yellow
    }
    Write-Host ''
    Write-Host '  Quick Start:' -ForegroundColor White
    Write-Host '    magnet2torrent                           # Interactive mode' -ForegroundColor Cyan
    Write-Host '    magnet2torrent search "Ubuntu"           # Search and open/stream' -ForegroundColor Cyan
    Write-Host '    magnet2torrent search "Movie" --vlc      # Stream directly in VLC' -ForegroundColor Cyan
    Write-Host '    magnet2torrent stream "magnet:?..."      # Play a magnet link in VLC' -ForegroundColor Cyan
    Write-Host ''
} finally {
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
