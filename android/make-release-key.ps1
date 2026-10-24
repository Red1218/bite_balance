# One-time: creates the release signing key and android/keystore.properties (both ignored by git).
# Back up bite-balance-release.jks and the password: without them the app can't be updated in place.
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$jks = Join-Path $dir 'bite-balance-release.jks'
if (Test-Path $jks) { throw "$jks already exists - not overwriting it." }

$p1 = Read-Host 'Choose a key password (min 6 chars)' -AsSecureString
$p2 = Read-Host 'Type it again' -AsSecureString
$pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
$pw2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
if ($pw -ne $pw2) { throw 'Passwords did not match.' }
if ($pw.Length -lt 6) { throw 'Password must be at least 6 characters.' }

$env:BB_KEY_PW = $pw
keytool -genkeypair -v -keystore $jks -storetype PKCS12 -alias bite-balance -keyalg RSA -keysize 2048 -validity 10000 `
  -dname 'CN=Bite Balance' -storepass:env BB_KEY_PW -keypass:env BB_KEY_PW
Remove-Item Env:BB_KEY_PW
if ($LASTEXITCODE -ne 0) { throw 'keytool failed.' }

# Properties files treat backslash as an escape character.
$esc = $pw.Replace('\', '\\')
@"
storeFile=../bite-balance-release.jks
storePassword=$esc
keyAlias=bite-balance
keyPassword=$esc
"@ | Set-Content -Encoding ascii (Join-Path $dir 'keystore.properties')
Write-Host "`nDone. Back up $jks and your password somewhere safe (Drive / password manager)." -ForegroundColor Green
