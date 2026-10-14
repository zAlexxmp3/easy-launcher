const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    obtenerAccesos: () => ipcRenderer.invoke('obtener-accesos'),
    agregarAcceso: (tipo) => ipcRenderer.invoke('agregar-acceso', tipo),
    agregarWeb: (datos) => ipcRenderer.invoke('agregar-web', datos),
    abrirAcceso: (acceso) => ipcRenderer.invoke('abrir-acceso', acceso),
    eliminarAcceso: (id) => ipcRenderer.invoke('eliminar-acceso', id),
    toggleFavorito: (id) => ipcRenderer.invoke('toggle-favorito', id),
    detectarJuegos: () => ipcRenderer.invoke('detectar-juegos'),
    agregarDetectados: (juegos) => ipcRenderer.invoke('agregar-detectados', juegos),
    elegirCarpetaSteam: () => ipcRenderer.invoke('elegir-carpeta-steam'),
    elegirCarpetaEpic: () => ipcRenderer.invoke('elegir-carpeta-epic'),
    resetearConfig: () => ipcRenderer.invoke('resetear-config'),
    onCerrando: (callback) => ipcRenderer.on('cerrando-app', callback)
});