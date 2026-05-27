param(
    [string]$OutPath = "${PWD}\.vscode\out\system_info.exe"
)

# Build script for system_info example using MSYS2 g++
try {
    $root = Resolve-Path (Join-Path $PSScriptRoot '..\\测试')
} catch {
    $root = Resolve-Path (Join-Path $PSScriptRoot '..')
}

Write-Host "Building system_info from $root to $OutPath"

if (-Not (Test-Path (Split-Path $OutPath -Parent))) {
    New-Item -ItemType Directory -Path (Split-Path $OutPath -Parent) -Force | Out-Null
}

$gpp = 'D:\\App box\\MSYS2\\ucrt64\\bin\\g++.exe'
if (-not (Test-Path $gpp)) {
    Write-Error "g++ not found at $gpp. Adjust script or install MSYS2/gcc."
    exit 1
}

# Collect sources (library sources + windows specifics)
$srcs = Get-ChildItem -Path (Join-Path $root 'src') -Recurse -Filter *.cpp | ForEach-Object { $_.FullName } | Where-Object { $_ -notmatch '\\opencl\\' }

$include = Join-Path $root 'include'

$args = @('-DWIN32','-DHWINFO_EXPORTS','-I',"$include",'-fdiagnostics-color=always','-g')
$args += $srcs
$args += (Join-Path $root 'examples\\system_infoMain.cpp')
$args += @('-o',"$OutPath",'-lole32','-loleaut32','-lwbemuuid','-ldxgi','-lsetupapi','-lpowrprof','-lntdll')

Write-Host "Invoking: $gpp $($args -join ' ')"

$output = & $gpp @args 2>&1
$exitCode = $LASTEXITCODE
$output | ForEach-Object { Write-Host $_ }

if ($exitCode -ne 0) {
    Write-Error "Build failed with exit code $exitCode"
    exit $exitCode
}

Write-Host "Build succeeded: $OutPath"
