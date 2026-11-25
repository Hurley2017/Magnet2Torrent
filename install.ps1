# Magnet2Torrent Desktop Windows Installer (PowerShell iex)
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
$DesktopDir = Join-Path $AppDir 'desktop'
$BinDir = Join-Path $InstallRoot 'bin'
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("m2t-desktop-install-" + [Guid]::NewGuid().ToString('N'))

Write-Host ''
Write-Host '  ==================================================================' -ForegroundColor Cyan
Write-Host '                 Magnet2Torrent Desktop Installer                   ' -ForegroundColor Cyan
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

function Get-NodeInfo {
    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    }
    if (-not $nodeCmd) { return $null }
    try {
        $raw = (& $nodeCmd.Source -p "process.versions.node" 2>$null).Trim()
        $parts = $raw.Split('.')
        return @{
            Source = $nodeCmd.Source
            Major  = [int]$parts[0]
            Minor  = [int]$parts[1]
            Version = $raw
        }
    } catch {
        return $null
    }
}

$nodeInfo = Get-NodeInfo
$nodeTooOld = (-not $nodeInfo) -or ($nodeInfo.Major -lt 22) -or ($nodeInfo.Major -eq 22 -and $nodeInfo.Minor -lt 12)
if ($nodeTooOld) {
    Write-Host '[*] Node.js >= 22.12 is required. Checking winget to install OpenJS.NodeJS.LTS...' -ForegroundColor Cyan
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
        & $winget.Source install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Refresh-SessionPath
        $nodeInfo = Get-NodeInfo
        $nodeTooOld = (-not $nodeInfo) -or ($nodeInfo.Major -lt 22) -or ($nodeInfo.Major -eq 22 -and $nodeInfo.Minor -lt 12)
    }
    if ($nodeTooOld) {
        throw 'Node.js >= 22.12 was not found. Install Node.js LTS from https://nodejs.org/ and re-run this installer.'
    }
}
Write-Host "[+] Node.js v$($nodeInfo.Version) detected." -ForegroundColor Green

try {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    $ZipPath = Join-Path $TempDir 'repo.zip'
    $ExtractDir = Join-Path $TempDir 'extracted'

    Write-Host "[*] Downloading Magnet2Torrent Desktop from GitHub ($Branch)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ZipPath -UseBasicParsing

    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force
    $SourceRoot = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1
    if (-not $SourceRoot) {
        throw 'Downloaded archive was empty or could not be extracted.'
    }

    $SourceDesktop = Join-Path $SourceRoot.FullName 'desktop'
    if (-not (Test-Path $SourceDesktop)) {
        throw 'Desktop application directory was not found in the repository archive.'
    }

    New-Item -ItemType Directory -Path $AppDir -Force | Out-Null

    $TargetElectronExe = Join-Path $DesktopDir 'node_modules\electron\dist\electron.exe'
    Get-Process electron -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $TargetElectronExe } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300

    # Clean up any leftover legacy CLI files from earlier versions
    foreach ($legacyItem in @('index.js', 'launch.bat', 'lib', 'magnet.ico', 'package.json', 'package-lock.json', 'node_modules')) {
        $legacyPath = Join-Path $AppDir $legacyItem
        if (Test-Path $legacyPath) {
            Remove-Item -Path $legacyPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    $LegacyDeskLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Magnet2Torrent CLI.lnk'
    if (Test-Path $LegacyDeskLnk) {
        Remove-Item -Path $LegacyDeskLnk -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path $DesktopDir) {
        $ExistingDesktopModules = Join-Path $DesktopDir 'node_modules'
        $BackupModules = Join-Path $TempDir 'desktop_node_modules_backup'
        if (Test-Path $ExistingDesktopModules) {
            Move-Item -Path $ExistingDesktopModules -Destination $BackupModules -Force
        }
        Remove-Item -Path $DesktopDir -Recurse -Force
        Copy-Item -Path $SourceDesktop -Destination $DesktopDir -Recurse -Force
        if (Test-Path $BackupModules) {
            Move-Item -Path $BackupModules -Destination (Join-Path $DesktopDir 'node_modules') -Force
        }
    } else {
        Copy-Item -Path $SourceDesktop -Destination $DesktopDir -Recurse -Force
    }

    foreach ($docFile in @('README.md', 'DISCLAIMER.md', 'LICENSE')) {
        $src = Join-Path $SourceRoot.FullName $docFile
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination (Join-Path $AppDir $docFile) -Force
        }
    }

    $NpmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $NpmCmd) {
        $NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
    }
    if (-not $NpmCmd) {
        throw 'npm was not found alongside Node.js. Please repair your Node.js installation.'
    }

    Write-Host '[*] Installing Magnet2Torrent Desktop packages (Electron + WebTorrent P2P + VLC engine)...' -ForegroundColor Cyan
    Push-Location $DesktopDir
    try {
        & $NpmCmd.Source install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }

        $ElectronExe = Join-Path $DesktopDir 'node_modules\electron\dist\electron.exe'
        $ElectronInstallJs = Join-Path $DesktopDir 'node_modules\electron\install.js'
        if (-not (Test-Path $ElectronExe) -and (Test-Path $ElectronInstallJs)) {
            Write-Host '[*] Downloading Electron desktop runtime binary...' -ForegroundColor Cyan
            & $nodeInfo.Source $ElectronInstallJs
            if ($LASTEXITCODE -ne 0) {
                throw "Electron runtime download failed with exit code $LASTEXITCODE"
            }
        }
    } finally {
        Pop-Location
    }

    $ElectronExe = Join-Path $DesktopDir 'node_modules\electron\dist\electron.exe'
    if (-not (Test-Path $ElectronExe)) {
        throw "Electron executable not found at $ElectronExe"
    }

    # Terminal launcher shim (launches Desktop window cleanly without hanging shell)
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    $ShimPath = Join-Path $BinDir 'magnet2torrent.cmd'
    $ShimContent = "@echo off`r`nstart `"`" `"$ElectronExe`" `"$DesktopDir`" %*`r`n"
    Set-Content -Path $ShimPath -Value $ShimContent -Encoding Ascii -Force

    # Create Desktop and Start Menu shortcuts
    $IconPath = Join-Path $DesktopDir 'assets\icon.ico'
    $WshShell = New-Object -ComObject WScript.Shell
    $ShortcutTargets = @()
    $DesktopFolder = [Environment]::GetFolderPath('Desktop')
    $ProgramsFolder = [Environment]::GetFolderPath('Programs')
    if ($DesktopFolder -and (Test-Path $DesktopFolder)) {
        $ShortcutTargets += (Join-Path $DesktopFolder 'Magnet2Torrent.lnk')
    }
    if ($ProgramsFolder -and (Test-Path $ProgramsFolder)) {
        $ShortcutTargets += (Join-Path $ProgramsFolder 'Magnet2Torrent.lnk')
    }

    foreach ($lnkPath in $ShortcutTargets) {
        $shortcut = $WshShell.CreateShortcut($lnkPath)
        $shortcut.TargetPath = $ElectronExe
        $shortcut.Arguments = "`"$DesktopDir`""
        $shortcut.WorkingDirectory = $DesktopDir
        if (Test-Path $IconPath) {
            $shortcut.IconLocation = "$IconPath,0"
        }
        $shortcut.Description = 'Magnet2Torrent Desktop - Search and Direct VLC Streamer'
        $shortcut.Save()
        Write-Host "[+] Shortcut created: $lnkPath" -ForegroundColor Green
    }

    # Add User PATH entry without duplicates
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
    Write-Host '[+] Magnet2Torrent Desktop installed successfully!' -ForegroundColor Green
    Write-Host "    App Folder: $DesktopDir" -ForegroundColor Gray
    if ($vlcFound) {
        Write-Host "    VLC Player: Detected ($vlcFound)" -ForegroundColor Gray
    } else {
        Write-Host '    VLC Player: Not detected yet (recommended for direct playback).' -ForegroundColor Yellow
        Write-Host '                Install with: winget install VideoLAN.VLC' -ForegroundColor Yellow
    }
    Write-Host ''
    Write-Host '  Launch anytime from your Desktop shortcut, Start Menu ("Magnet2Torrent"),' -ForegroundColor White
    Write-Host '  or by running "magnet2torrent" in any terminal.' -ForegroundColor Cyan
    Write-Host ''
} finally {
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
