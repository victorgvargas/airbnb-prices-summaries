# Building Airbnb Price Analyzer

## 📦 Available Build Commands

### Build for Current Platform
```bash
npm run build
```

### Build for Specific Platforms
```bash
# macOS (requires macOS or GitHub Actions)
npm run build-mac

# Windows (requires Windows, Wine, or GitHub Actions) 
npm run build-win

# Linux (works on any platform)
npm run build-linux

# Build for all platforms
npm run dist
```

## 🚀 Automated Builds with GitHub Actions

The repository includes a GitHub Actions workflow that automatically builds for all platforms:

1. Push a tag starting with `v` (e.g., `v1.0.0`):
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. Or manually trigger the workflow from the GitHub Actions tab

## 📁 Build Outputs

After building, find your installers in the `dist/` folder:

### macOS
- `Airbnb Price Analyzer-1.0.0.dmg` - Standard macOS installer
- `Airbnb Price Analyzer-1.0.0-arm64.dmg` - Apple Silicon (M1/M2) version

### Windows  
- `Airbnb Price Analyzer Setup 1.0.0.exe` - Windows installer (NSIS)
- `Airbnb Price Analyzer 1.0.0.exe` - Portable Windows executable

### Linux
- `Airbnb Price Analyzer-1.0.0.AppImage` - Universal Linux app
- `airbnb-price-analyzer_1.0.0_amd64.deb` - Debian/Ubuntu package

## 🔧 Build Requirements

- **Node.js** 16+ 
- **npm** or **yarn**
- **Git** (for version tagging)

### Platform-Specific Requirements

- **macOS builds**: Requires macOS (native) or GitHub Actions  
- **Windows builds**: Requires Windows, Wine, or GitHub Actions
- **Linux builds**: Works on any platform

## 🎨 App Icons

Place these icon files in the `assets/` folder for professional-looking apps:

- `icon.icns` - macOS icon (512x512 or larger)
- `icon.ico` - Windows icon (256x256 or larger)
- `icon.png` - Linux icon (512x512 PNG)

Without custom icons, apps will use the default Electron icon.

## 📋 Build Configuration

All build settings are configured in `package.json` under the `"build"` section. You can customize:

- App name and ID
- Output formats (DMG, NSIS, AppImage, DEB, etc.)
- Target architectures (x64, arm64)
- Installation options
- File associations

## 🐛 Troubleshooting

### Common Issues

1. **Missing dependencies**: Run `npm install` first
2. **Permission errors**: Check file permissions in `electron/` folder
3. **Icon errors**: Icons are optional - remove icon paths if missing
4. **Platform restrictions**: Use GitHub Actions for cross-platform builds

### Build Logs

Check the terminal output for detailed build information and error messages.

## 🌍 Distribution

### Direct Distribution
- Upload the built installers to your website
- Share via cloud storage (Dropbox, Google Drive, etc.)

### App Stores  
- **Mac App Store**: Requires Apple Developer account
- **Microsoft Store**: Requires Windows Developer account
- **Snap Store**: Free Linux distribution

### GitHub Releases
The GitHub Actions workflow can automatically create releases with built apps.
