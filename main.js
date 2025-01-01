const { app, BrowserWindow } = require('electron');
const path = require('path');

// Globals for windows
let mainWindow;

function createMainWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    resizable: false,
    icon: path.join(__dirname, 'favicon.png'),  // Ensure the correct icon is provided
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Load the URL instead of a local file
  mainWindow.loadURL('https://vizzy.io/');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App initialization
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (!mainWindow) createMainWindow();
  });
});