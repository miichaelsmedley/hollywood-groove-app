# Hollywood Groove Mobile App

Cross-platform PWA mobile app for Hollywood Groove.


## Overview

Mobile app for attendees to browse shows, purchase tickets, and discover venues for Hollywood Groove themed DJ nights.

## Requirements

- .NET 8.0 SDK
- Visual Studio 2022 17.8+ or VS Code with C# Dev Kit
- MAUI workload installed

## Quick Start
```bash
# Install MAUI workload
dotnet workload install maui

# Restore workloads
dotnet workload restore

# Restore dependencies
dotnet restore

# Build
dotnet build

# Run on Android
dotnet build -t:Run -f net8.0-android

# Run on iOS (Mac only)
dotnet build -t:Run -f net8.0-ios

# Run on Windows
dotnet build -t:Run -f net8.0-windows10.0.19041.0
```

## Project Structure
```
HollywoodGroove/
├── App/              # App lifecycle
├── Features/         # Feature modules
├── Models/           # Data models
├── Services/         # API and business logic
├── ViewModels/       # MVVM ViewModels
└── Views/            # UI pages
```

## Testing
```bash
dotnet test
```
