param(
    [string]$Email = "nikhil.shinde@classgrid.in",
    [string]$Password = "",
    [string]$BaseUrl = "https://classgrid.in"
)

if (-not $Password) {
    $Password = Read-Host "Enter password for $Email"
}

Write-Host "`n=== STEP 1: Login ===" -ForegroundColor Cyan

$loginPayload = @{
    email    = $Email
    password = $Password
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    Write-Host "Login SUCCESS" -ForegroundColor Green
    Write-Host "Role   : $($loginResp.user.role)"
    Write-Host "Org ID : $($loginResp.user.organization_id)"

    $token = $loginResp.token
    if (-not $token) {
        Write-Host "ERROR: No token returned. Login may have failed." -ForegroundColor Red
        exit 1
    }

    Write-Host "Token  : $($token.Substring(0, [Math]::Min(40, $token.Length)))..." -ForegroundColor Yellow

} catch {
    Write-Host "Login FAILED: $_" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)"
    exit 1
}

Write-Host "`n=== STEP 2: Create Classroom ===" -ForegroundColor Cyan

$classroomPayload = @{
    name        = "Test Classroom $(Get-Date -Format 'HH:mm:ss')"
    subject     = "Physics"
    description = "Automated test classroom"
    subjectSlug = "physics"
    settings    = @{
        maxStudents = 200
    }
} | ConvertTo-Json

$headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $createResp = Invoke-RestMethod -Uri "$BaseUrl/api/classrooms" `
        -Method POST `
        -Headers $headers `
        -Body $classroomPayload `
        -ErrorAction Stop

    Write-Host "Classroom Created!" -ForegroundColor Green
    Write-Host "Name      : $($createResp.classroom.name)"
    Write-Host "Class Code: $($createResp.classroom.classCode)"
    Write-Host "Subject   : $($createResp.classroom.subject)"
    Write-Host "ID        : $($createResp.classroom._id)"

} catch {
    Write-Host "Create Classroom FAILED!" -ForegroundColor Red
    Write-Host "Status : $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error  : $($_.ErrorDetails.Message)"
}
