param(
  [string]$Root = (Join-Path $PSScriptRoot ".."),
  [int]$Port = 4173
)

$serverRoot = [System.IO.Path]::GetFullPath($Root)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$mimeTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".glb" = "model/gltf-binary"
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".md" = "text/markdown; charset=utf-8"
  ".png" = "image/png"
  ".svg" = "image/svg+xml"
  ".webp" = "image/webp"
}

try {
  $listener.Start()
} catch [System.Net.Sockets.SocketException] {
  if ($_.Exception.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AddressAlreadyInUse) { exit 0 }
  throw
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
      while ($true) {
        $headerLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($headerLine)) { break }
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $rawTarget = $parts[1]
      $requestPath = [System.Uri]::UnescapeDataString(($rawTarget -split "\?")[0])
      if ($requestPath -eq "/") { $requestPath = "/index.html" }
      $relativePath = $requestPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $serverRoot $relativePath))
      $insideRoot = $filePath.StartsWith($serverRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)

      if (-not $insideRoot -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        $status = "404 Not Found"
        $contentType = "text/plain; charset=utf-8"
      } else {
        $body = [System.IO.File]::ReadAllBytes($filePath)
        $status = "200 OK"
        $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
      }

      $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($method -ne "HEAD") { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
    } catch {
      # A dropped browser connection must not terminate the local preview server.
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
