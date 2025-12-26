const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
    googleSignInSuccessInAuthWindow: (user) => ipcRenderer.send('google-sign-in-success-auth-window', user),
    googleSignInErrorInAuthWindow: (error) => ipcRenderer.send('google-sign-in-error-auth-window', error),
});
