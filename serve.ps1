# Локальный статический сервер для Windows без Python: http://localhost:4321
# Отдаёт файлы из папки, где лежит; /work/x.html, /404.html и т.п.
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:4321/')
$listener.Start()
"Serving $root at http://localhost:4321/"
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
            '.png'='image/png'; '.svg'='image/svg+xml'; '.xml'='application/xml'; '.txt'='text/plain'; '.ico'='image/x-icon' }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path.EndsWith('/')) { $path += 'index.html' }
  $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
  $res = $ctx.Response
  if (-not (Test-Path $file -PathType Leaf)) { $file = Join-Path $root '404.html'; $res.StatusCode = 404 }
  $ext = [IO.Path]::GetExtension($file).ToLower()
  $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
  $res.Headers['Cache-Control'] = 'no-store'
  $bytes = [IO.File]::ReadAllBytes($file)
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.Close()
}
