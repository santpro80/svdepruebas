# cobol-bridge.ps1 - Puente Extractor de Datos Maestros RM/COBOL (D:\WSFESA) -> Web JSON (D:\TERIAN-UNIFICADO\public\data-cobol)
param(
    [string]$WsfesaPath = "D:\WSFESA",
    [string]$OutDir = "D:\TERIAN-UNIFICADO\public\data-cobol"
)

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$enc = [System.Text.Encoding]::GetEncoding(850)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "1. Exportando Maestro de Sucursales (VIA47)..." -ForegroundColor Cyan
$sucursales = @(
    @{ codigo = "04"; extension = ".04"; nombre = "CASA MATRIZ / FABRICA"; localidad = "CASEROS"; provincia = "BUENOS AIRES"; direccion = "DR. REBIZO 5458/60"; tipo = "Casa Matriz & Planta Industrial"; activa = $true },
    @{ codigo = "05"; extension = ".05"; nombre = "SUCURSAL LA PLATA"; localidad = "LA PLATA"; provincia = "BUENOS AIRES"; direccion = "LA PLATA"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "07"; extension = ".07"; nombre = "SUCURSAL MAR DEL PLATA"; localidad = "MAR DEL PLATA"; provincia = "BUENOS AIRES"; direccion = "MAR DEL PLATA"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "08"; extension = ".08"; nombre = "SUCURSAL BAHIA BLANCA"; localidad = "BAHIA BLANCA"; provincia = "BUENOS AIRES"; direccion = "BAHIA BLANCA"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "20"; extension = ".20"; nombre = "SUCURSAL ROSARIO"; localidad = "ROSARIO"; provincia = "SANTA FE"; direccion = "ROSARIO"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "21"; extension = ".21"; nombre = "SUCURSAL 21"; localidad = "INTERIOR"; provincia = "ARGENTINA"; direccion = "SUCURSAL 21"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "22"; extension = ".22"; nombre = "SUCURSAL 22"; localidad = "INTERIOR"; provincia = "ARGENTINA"; direccion = "SUCURSAL 22"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "23"; extension = ".23"; nombre = "CENTRO LOGISTICO JUJUY"; localidad = "SAN SALVADOR DE JUJUY"; provincia = "JUJUY"; direccion = "JUJUY"; tipo = "Centro Logístico"; activa = $true },
    @{ codigo = "24"; extension = ".24"; nombre = "SUCURSAL CHACO"; localidad = "RESISTENCIA"; provincia = "CHACO"; direccion = "CHACO"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "25"; extension = ".25"; nombre = "SUCURSAL PARANA"; localidad = "PARANA"; provincia = "ENTRE RIOS"; direccion = "PARANA"; tipo = "Sucursal Comercial"; activa = $true },
    @{ codigo = "26"; extension = ".26"; nombre = "SUCURSAL CORDOBA"; localidad = "CORDOBA"; provincia = "CORDOBA"; direccion = "CORDOBA"; tipo = "Sucursal Comercial"; activa = $true }
)
[System.IO.File]::WriteAllText("$OutDir\sucursales.json", ($sucursales | ConvertTo-Json -Depth 4), $utf8NoBom)

function Extract-StringsFromRMKF {
    param([string]$FilePath, [int]$MinLen = 10, [int]$MaxItems = 300)
    if (!(Test-Path $FilePath)) { return @() }
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $limit = [Math]::Min($bytes.Length, 4 * 1024 * 1024)
    $text = $enc.GetString($bytes, 0, $limit)
    $matches = [regex]::Matches($text, "[A-Z0-9ÁÉÍÓÚÑ\.\,\-\/\(\) ]{$MinLen,80}")
    $list = New-Object System.Collections.Generic.HashSet[string]
    foreach ($m in $matches) {
        $val = ($m.Value -replace '\s+', ' ').Trim()
        if ($val.Length -ge $MinLen -and $val -notmatch '^0+$' -and $val -notmatch '^[0-9\-\.\/ ]+$' -and $val -notmatch 'RMKF') {
            [void]$list.Add($val)
            if ($list.Count -ge $MaxItems) { break }
        }
    }
    return @($list)
}

Write-Host "2. Extrayendo muestra de Clientes (VIA02), Medicos (VIA38) y Proveedores (VIA44)..." -ForegroundColor Cyan
$clientesRaw = Extract-StringsFromRMKF -FilePath "$WsfesaPath\VIA02" -MinLen 12 -MaxItems 250
$medicosRaw  = Extract-StringsFromRMKF -FilePath "$WsfesaPath\VIA38" -MinLen 10 -MaxItems 250
$provsRaw    = Extract-StringsFromRMKF -FilePath "$WsfesaPath\VIA44" -MinLen 10 -MaxItems 200

$clientes = @()
$idx = 1
foreach ($c in $clientesRaw) {
    $clientes += @{ id = ("CLI-{0:D4}" -f $idx); registroRaw = $c; origen = "VIA02 (WSFESA)" }
    $idx++
}
[System.IO.File]::WriteAllText("$OutDir\clientes_cobol.json", ($clientes | ConvertTo-Json -Depth 4), $utf8NoBom)

$medicos = @()
$idx = 1
foreach ($m in $medicosRaw) {
    $medicos += @{ id = ("MED-{0:D4}" -f $idx); nombreRaw = $m; origen = "VIA38 (WSFESA)" }
    $idx++
}
[System.IO.File]::WriteAllText("$OutDir\medicos_cobol.json", ($medicos | ConvertTo-Json -Depth 4), $utf8NoBom)

$proveedores = @()
$idx = 1
foreach ($p in $provsRaw) {
    $proveedores += @{ id = ("PRV-{0:D4}" -f $idx); razonSocialRaw = $p; origen = "VIA44 (WSFESA)" }
    $idx++
}
[System.IO.File]::WriteAllText("$OutDir\proveedores_cobol.json", ($proveedores | ConvertTo-Json -Depth 4), $utf8NoBom)

Write-Host "3. Copiando plantillas ZPL y Logos de Impresoras Zebra desde WSFESA..." -ForegroundColor Cyan
$zplLogos = @{}
Get-ChildItem "$WsfesaPath\*.zpl" -ErrorAction SilentlyContinue | ForEach-Object {
    $zplLogos[$_.Name] = [System.IO.File]::ReadAllText($_.FullName, $enc)
}
[System.IO.File]::WriteAllText("$OutDir\zebra_logos.json", ($zplLogos | ConvertTo-Json -Depth 4), $utf8NoBom)

$summary = @{
    generadoEn = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    origenCobol = $WsfesaPath
    sucursalesCount = $sucursales.Count
    clientesExtraidos = $clientes.Count
    medicosExtraidos = $medicos.Count
    proveedoresExtraidos = $proveedores.Count
    logosZplCount = $zplLogos.Count
}
[System.IO.File]::WriteAllText("$OutDir\resumen_puente.json", ($summary | ConvertTo-Json -Depth 4), $utf8NoBom)
Write-Host "Puente COBOL -> Web completado con exito:" -ForegroundColor Green
$summary | Format-Table -AutoSize
