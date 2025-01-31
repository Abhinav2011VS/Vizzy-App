const { app, BrowserWindow, session, Tray, Menu, Notification } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");

let mainWindow, splashWindow, tray;
const sessionFile = path.join(app.getPath("userData"), "session.json");

// Load & Save Last Page Session
function loadSession() {
  try {
    if (fs.existsSync(sessionFile)) {
      return JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    }
  } catch (err) {
    console.error("Error loading session:", err);
  }
  return null;
}

function saveSession(sessionData) {
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
  } catch (err) {
    console.error("Error saving session:", err);
  }
}

// **Power Boost Settings**
const powerFlags = [
  "enable-gpu-rasterization",
  "enable-zero-copy",
  "ignore-gpu-blacklist",
  "enable-native-gpu-memory-buffers",
  "enable-accelerated-video-decode",
  "enable-accelerated-video-encode",
  "disable-background-timer-throttling",
  "disable-renderer-backgrounding",
  "disable-accelerated-2d-canvas",
  "enable-oop-rasterization",
  "renderer-process-limit=100",
  "disable-frame-rate-limit",
  "disable-gpu-vsync",
  "js-flags=--max-old-space-size=16384 --expose-gc",
  "disable-backgrounding-occluded-windows",
  "disable-ipc-flooding-protection",
  "disable-hang-monitor",
];

powerFlags.forEach((flag) => app.commandLine.appendSwitch(flag));
app.commandLine.appendSwitch(
  "enable-features",
  "VaapiVideoDecoder,WebRTC-H264WithOpenH264FFmpeg,CanvasOopRasterization,WebAssemblySimd"
);

// **Create Splash Screen (Now with a Cool Fade-in Effect!)**
function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
  });

  splashWindow.loadFile("splash.html");

  // **Fade-in effect**
  splashWindow.setOpacity(0);
  let opacity = 0;
  let fadeIn = setInterval(() => {
    if (opacity < 1) {
      opacity += 0.05;
      splashWindow.setOpacity(opacity);
    } else {
      clearInterval(fadeIn);
    }
  }, 50);
}

// **Create Main Window (Preloads in Background)**
function createMainWindow() {
  let sessionData = loadSession();
  let lastURL = sessionData?.lastPage || "https://vizzy.io/";

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "favicon.png"),
    show: false, // Hidden initially
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      enableBlinkFeatures: "HTMLImports,CustomElements",
    },
  });

  mainWindow.loadURL(lastURL);

  // Save Last Page
  mainWindow.webContents.on("did-navigate", (_, url) => {
    saveSession({ lastPage: url });
  });

  // **Show Main Window When Loaded (Hides Splash)**
  let maxSplashTime = 10000; // 10s max wait
  let startTime = Date.now();

  const checkLoadInterval = setInterval(() => {
    if (mainWindow.webContents.isLoading() === false || Date.now() - startTime >= maxSplashTime) {
      clearInterval(checkLoadInterval);
      
      mainWindow.show();
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    }
  }, 500);

  // **Minimize to Tray Instead of Closing**
  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow.hide();
    new Notification({ title: "App Minimized", body: "App is still running in the system tray." }).show();
  });
}

// **Create Tray with Open, Clear Cache & Exit**
function createTray() {
  tray = new Tray(path.join(__dirname, "favicon.png"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open App",
      click: () => {
        if (!mainWindow) {
          createMainWindow();
        } else {
          mainWindow.show();
        }
        new Notification({ title: "App Opened", body: "App is now running." }).show();
      },
    },
    {
      label: "Clear Cache",
      click: () => {
        mainWindow.webContents.session.clearCache().then(() => {
          new Notification({ title: "Cache Cleared", body: "All temporary files have been removed." }).show();
        });
      },
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip("Electron App");
  tray.setContextMenu(contextMenu);
}

// **Boost Process Priority**
function boostElectronPriority() {
  if (process.platform === "win32") {
    exec("wmic process where name='electron.exe' CALL setpriority 128", (err) => {
      if (err) console.error("Failed to set process priority:", err);
    });
  } else {
    exec(`renice -n -15 -p ${process.pid}`, (err) => {
      if (err) console.error("Failed to set process priority:", err);
    });
  }
}

// **App Startup Process**
app.whenReady().then(() => {
  createSplashScreen();
  createTray();

  // **Delay Main Window to Prioritize Splash**
  setTimeout(() => {
    createMainWindow();
    boostElectronPriority();
  }, 5000);

  app.on("activate", () => {
    if (!mainWindow) createMainWindow();
  });
});

// **Quit app when all windows are closed (Except Mac)**
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
