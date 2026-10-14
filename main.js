const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 🔑 TU API KEY DE STEAMGRIDDB
const STEAMGRIDDB_API_KEY = '292908d1212b7e987c69e6271cb5605f';

let sgdb = null;

async function inicializarSGDB() {
    if (!STEAMGRIDDB_API_KEY || STEAMGRIDDB_API_KEY === 'TU_API_KEY_ACA') return;
    try {
        const { default: SGDB } = await import('steamgriddb');
        sgdb = new SGDB({ key: STEAMGRIDDB_API_KEY });
        console.log('✅ SteamGridDB configurado');
    } catch (e) {
        console.error('❌ Error SGDB:', e);
    }
}

const DATA_FILE = path.join(__dirname, 'accesos.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

let mainWindow;

function crearVentana() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#000000',
        title: 'Easy Launcher',
        icon: path.join(__dirname, 'logo.ico'),  // 👈 ÍCONO ACÁ
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile('index.html');
}

function leerAccesos() {
    try {
        if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) { console.error(e); }
    return [];
}

function guardarAccesos(accesos) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(accesos, null, 2), 'utf-8'); }
    catch (e) { console.error(e); }
}

function leerConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) { /* silencio */ }
    return { carpetasSteam: [], carpetasEpic: [] };
}

function guardarConfig(config) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8'); }
    catch (e) { console.error(e); }
}

// ==========================================
// BUSCAR PORTADA EN STEAMGRIDDB
// ==========================================
async function buscarPortada(nombreJuego) {
    if (!sgdb) {
        console.log('   ⚠️ SGDB no inicializado');
        return null;
    }

    try {
        let nombreLimpio = nombreJuego
            .replace(/[™®©]/g, '')
            .replace(/\s*\(.*?\)\s*/g, ' ')
            .replace(/\s*\[.*?\]\s*/g, ' ')
            .replace(/\s*-\s*$/, '')
            .trim();

        console.log(`   🔎 Buscando: "${nombreLimpio}"`);

        let juegos = await sgdb.searchGame(nombreLimpio);
        if (juegos && !Array.isArray(juegos)) juegos = [juegos];

        if (!juegos || juegos.length === 0) {
            console.log(`      ❌ No encontrado en SGDB`);
            return null;
        }

        const juego = juegos[0];
        console.log(`      🎯 Match: ${juego.name}`);

        const portadas = await sgdb.getGrids({ type: 'game', id: juego.id });

        if (!portadas || portadas.length === 0) {
            console.log(`      ❌ Sin portadas`);
            return null;
        }

        console.log(`      ✅ ${portadas.length} portadas`);
        return portadas[0].url;

    } catch (error) {
        console.log(`      ⚠️ Error: ${error.message}`);
        return null;
    }
}

// ==========================================
// BÚSQUEDA PROFUNDA
// ==========================================
function buscarSteamEnDisco(disco, max = 4, actual = 0) {
    const resultados = [];
    const ignorar = ['windows', '$recycle.bin', 'system volume information',
        'programdata', 'appdata', 'node_modules', '.git', 'temp', 'tmp',
        'cache', 'intel', 'amd', 'nvidia', 'perflogs', 'recovery',
        'msocache', 'onedrive', 'documents and settings', 'users'];

    if (actual > max) return resultados;

    let items;
    try { items = fs.readdirSync(disco, { withFileTypes: true }); }
    catch (e) { return resultados; }

    for (const item of items) {
        if (!item.isDirectory()) continue;
        const n = item.name.toLowerCase();
        if (ignorar.includes(n) || item.name.startsWith('.') || item.name.startsWith('$')) continue;

        const ruta = path.join(disco, item.name);

        if (n === 'steamapps') {
            try {
                const archivos = fs.readdirSync(ruta);
                if (archivos.some(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))) {
                    resultados.push(ruta);
                }
            } catch (e) { /* silencio */ }
        }

        if (n === 'steam' || n === 'steamlibrary') {
            const sa = path.join(ruta, 'steamapps');
            try {
                if (fs.existsSync(sa)) {
                    const archivos = fs.readdirSync(sa);
                    if (archivos.some(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))) {
                        resultados.push(sa);
                    }
                }
            } catch (e) { /* silencio */ }
        }

        if (n !== 'steam' && n !== 'steamlibrary' && n !== 'steamapps') {
            resultados.push(...buscarSteamEnDisco(ruta, max, actual + 1));
        }
    }
    return resultados;
}

function buscarEpicEnDisco(disco, max = 4, actual = 0) {
    const resultados = [];
    const ignorar = ['windows', '$recycle.bin', 'system volume information',
        'node_modules', '.git', 'temp', 'tmp', 'cache', 'intel',
        'amd', 'nvidia', 'perflogs', 'recovery', 'msocache'];

    if (actual > max) return resultados;

    let items;
    try { items = fs.readdirSync(disco, { withFileTypes: true }); }
    catch (e) { return resultados; }

    for (const item of items) {
        if (!item.isDirectory()) continue;
        const n = item.name.toLowerCase();
        if (ignorar.includes(n) || item.name.startsWith('.') || item.name.startsWith('$')) continue;

        const ruta = path.join(disco, item.name);

        if (n === 'manifests') {
            try {
                const archivos = fs.readdirSync(ruta);
                if (archivos.some(f => f.endsWith('.item'))) resultados.push(ruta);
            } catch (e) { /* silencio */ }
        }

        resultados.push(...buscarEpicEnDisco(ruta, max, actual + 1));
    }
    return resultados;
}

// ==========================================
// DETECCIÓN STEAM
// ==========================================
async function detectarSteam() {
    const juegos = [];
    const config = leerConfig();
    let carpetas = [...(config.carpetasSteam || [])];

    if (carpetas.length === 0) {
        for (const d of ['C:', 'D:', 'E:', 'F:', 'G:', 'H:']) {
            try {
                if (!fs.existsSync(d + '\\')) continue;
                console.log(`🔍 Steam en ${d}...`);
                carpetas.push(...buscarSteamEnDisco(d + '\\'));
            } catch (e) { /* silencio */ }
        }
        carpetas = [...new Set(carpetas)];
    }

    console.log('✅ Carpetas Steam:', carpetas);

    carpetas.forEach(sa => {
        try {
            const archivos = fs.readdirSync(sa);
            archivos.forEach(a => {
                if (a.startsWith('appmanifest_') && a.endsWith('.acf')) {
                    try {
                        const c = fs.readFileSync(path.join(sa, a), 'utf-8');
                        const nom = c.match(/"name"\s+"([^"]+)"/);
                        const id = c.match(/"appid"\s+"([^"]+)"/);
                        const inst = c.match(/"installdir"\s+"([^"]+)"/);
                        if (nom && id) {
                            juegos.push({
                                nombre: nom[1],
                                tipo: 'juego',
                                ruta: `steam://rungameid/${id[1]}`,
                                rutaLocal: path.join(sa, 'common', inst ? inst[1] : ''),
                                categoria: 'Juegos',
                                launcher: 'Steam',
                                appid: id[1],
                                imagen: '',
                                favorito: false,
                                vecesAbierto: 0,
                                ultimaVez: 0
                            });
                        }
                    } catch (e) { /* silencio */ }
                }
            });
        } catch (e) { /* silencio */ }
    });

    if (sgdb && juegos.length > 0) {
        console.log(`\n🎨 Buscando portadas para ${juegos.length} juegos...\n`);
        for (let i = 0; i < juegos.length; i++) {
            const portada = await buscarPortada(juegos[i].nombre);
            if (portada) juegos[i].imagen = portada;
            await new Promise(r => setTimeout(r, 200));
        }
        console.log('\n✅ Portadas completadas\n');
    }

    return juegos;
}

// ==========================================
// DETECCIÓN EPIC
// ==========================================
async function detectarEpic() {
    const juegos = [];
    const config = leerConfig();
    let carpetas = [...(config.carpetasEpic || [])];

    if (carpetas.length === 0) {
        const tipicas = ['C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests'];
        tipicas.forEach(r => { if (fs.existsSync(r)) carpetas.push(r); });

        if (carpetas.length === 0) {
            for (const d of ['C:', 'D:', 'E:', 'F:', 'G:', 'H:']) {
                try {
                    if (!fs.existsSync(d + '\\')) continue;
                    console.log(`🔍 Epic en ${d}...`);
                    carpetas.push(...buscarEpicEnDisco(d + '\\'));
                } catch (e) { /* silencio */ }
            }
        }
        carpetas = [...new Set(carpetas)];
    }

    console.log('✅ Carpetas Epic:', carpetas);

    carpetas.forEach(carpeta => {
        try {
            const archivos = fs.readdirSync(carpeta);
            archivos.forEach(a => {
                if (a.endsWith('.item')) {
                    try {
                        const data = JSON.parse(fs.readFileSync(path.join(carpeta, a), 'utf-8'));
                        if (data.DisplayName && data.InstallLocation) {
                            const exe = data.LaunchExecutable || '';
                            juegos.push({
                                nombre: data.DisplayName,
                                tipo: 'juego',
                                ruta: exe ? path.join(data.InstallLocation, exe) : data.InstallLocation,
                                rutaLocal: data.InstallLocation,
                                categoria: 'Juegos',
                                launcher: 'Epic',
                                imagen: '',
                                favorito: false,
                                vecesAbierto: 0,
                                ultimaVez: 0
                            });
                        }
                    } catch (e) { /* silencio */ }
                }
            });
        } catch (e) { /* silencio */ }
    });

    if (sgdb && juegos.length > 0) {
        console.log(`\n🎨 Buscando portadas para ${juegos.length} juegos de Epic...\n`);
        for (let i = 0; i < juegos.length; i++) {
            const portada = await buscarPortada(juegos[i].nombre);
            if (portada) juegos[i].imagen = portada;
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return juegos;
}

// ==========================================
// IPC HANDLERS
// ==========================================
ipcMain.handle('obtener-accesos', () => leerAccesos());

ipcMain.handle('detectar-juegos', async () => {
    try {
        console.log('\n🚀 Iniciando detección...\n');
        const s = await detectarSteam();
        const e = await detectarEpic();
        const total = [...s, ...e];
        console.log(`\n📊 Steam: ${s.length} | Epic: ${e.length}`);
        console.log(`📊 Con imagen: ${total.filter(j => j.imagen).length}`);
        console.log(`📊 Sin imagen: ${total.filter(j => !j.imagen).length}\n`);
        return { steam: s.length, epic: e.length, juegos: total };
    } catch (err) {
        console.error(err);
        return { steam: 0, epic: 0, juegos: [] };
    }
});

ipcMain.handle('elegir-carpeta-steam', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
        title: 'Seleccioná la carpeta "steamapps" de Steam',
        properties: ['openDirectory']
    });
    if (r.canceled || !r.filePaths.length) return null;

    let ruta = r.filePaths[0];
    const n = path.basename(ruta).toLowerCase();
    if (n === 'steam' || n === 'steamlibrary') {
        const sa = path.join(ruta, 'steamapps');
        if (fs.existsSync(sa)) ruta = sa;
    }

    const config = leerConfig();
    if (!config.carpetasSteam) config.carpetasSteam = [];
    if (!config.carpetasSteam.includes(ruta)) config.carpetasSteam.push(ruta);
    guardarConfig(config);
    return ruta;
});

ipcMain.handle('elegir-carpeta-epic', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
        title: 'Seleccioná la carpeta de Epic Games',
        properties: ['openDirectory']
    });
    if (r.canceled || !r.filePaths.length) return null;

    let ruta = r.filePaths[0];
    const n = path.basename(ruta).toLowerCase();
    if (n.includes('epic')) {
        const sub = path.join(ruta, 'EpicGamesLauncher', 'Data', 'Manifests');
        if (fs.existsSync(sub)) ruta = sub;
        else {
            const sub2 = path.join(ruta, 'Data', 'Manifests');
            if (fs.existsSync(sub2)) ruta = sub2;
        }
    }

    const config = leerConfig();
    if (!config.carpetasEpic) config.carpetasEpic = [];
    if (!config.carpetasEpic.includes(ruta)) config.carpetasEpic.push(ruta);
    guardarConfig(config);
    return ruta;
});

ipcMain.handle('resetear-config', () => {
    guardarConfig({ carpetasSteam: [], carpetasEpic: [] });
    return true;
});

ipcMain.handle('agregar-detectados', async (event, nuevos) => {
    const accesos = leerAccesos();
    const existentes = new Set(accesos.map(a => a.nombre.toLowerCase()));
    let agregados = 0;
    nuevos.forEach(j => {
        if (!existentes.has(j.nombre.toLowerCase())) {
            j.id = Date.now() + Math.random();
            accesos.push(j);
            agregados++;
        }
    });
    guardarAccesos(accesos);
    return agregados;
});

ipcMain.handle('agregar-acceso', async (event, tipo) => {
    const accesos = leerAccesos();
    let nuevo = null;

    if (tipo === 'juego') {
        const r = await dialog.showOpenDialog(mainWindow, {
            title: 'Seleccionar ejecutable',
            filters: [
                { name: 'Ejecutables', extensions: ['exe', 'lnk', 'bat'] },
                { name: 'Todos', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        if (r.canceled || !r.filePaths.length) return null;
        const ruta = r.filePaths[0];
        nuevo = {
            id: Date.now(), tipo: 'juego',
            nombre: path.basename(ruta, path.extname(ruta)),
            ruta, categoria: 'Juegos', imagen: '',
            favorito: false, vecesAbierto: 0, ultimaVez: 0
        };

        const portada = await buscarPortada(nuevo.nombre);
        if (portada) nuevo.imagen = portada;
    }

    if (tipo === 'carpeta') {
        const r = await dialog.showOpenDialog(mainWindow, {
            title: 'Seleccionar carpeta',
            properties: ['openDirectory']
        });
        if (r.canceled || !r.filePaths.length) return null;
        const ruta = r.filePaths[0];
        nuevo = {
            id: Date.now(), tipo: 'carpeta', nombre: path.basename(ruta),
            ruta, categoria: 'Carpetas', imagen: '',
            favorito: false, vecesAbierto: 0, ultimaVez: 0
        };
    }

    if (nuevo) {
        accesos.push(nuevo);
        guardarAccesos(accesos);
    }
    return nuevo;
});

ipcMain.handle('agregar-web', (event, datos) => {
    const accesos = leerAccesos();
    const nuevo = {
        id: Date.now(), tipo: 'web', nombre: datos.nombre, url: datos.url,
        categoria: 'Webs', imagen: '',
        favorito: false, vecesAbierto: 0, ultimaVez: 0
    };
    accesos.push(nuevo);
    guardarAccesos(accesos);
    return nuevo;
});

ipcMain.handle('abrir-acceso', async (event, acceso) => {
    try {
        const accesos = leerAccesos();
        const idx = accesos.findIndex(a => a.id === acceso.id);
        if (idx !== -1) {
            accesos[idx].vecesAbierto = (accesos[idx].vecesAbierto || 0) + 1;
            accesos[idx].ultimaVez = Date.now();
            guardarAccesos(accesos);
        }
        if (acceso.tipo === 'juego' || acceso.tipo === 'carpeta') {
            if (acceso.ruta && acceso.ruta.startsWith('steam://')) shell.openExternal(acceso.ruta);
            else await shell.openPath(acceso.ruta);
        } else if (acceso.tipo === 'web') {
            const win = new BrowserWindow({
                width: 1200, height: 800, title: acceso.nombre,
                autoHideMenuBar: true, backgroundColor: '#0e0e10',
                webPreferences: { contextIsolation: true, nodeIntegration: false }
            });
            win.loadURL(acceso.url);
        }
        return true;
    } catch (e) { console.error(e); return false; }
});

ipcMain.handle('toggle-favorito', (event, id) => {
    const accesos = leerAccesos();
    const idx = accesos.findIndex(a => a.id === id);
    if (idx !== -1) {
        accesos[idx].favorito = !accesos[idx].favorito;
        guardarAccesos(accesos);
        return accesos[idx].favorito;
    }
    return false;
});

ipcMain.handle('eliminar-acceso', (event, id) => {
    let accesos = leerAccesos();
    accesos = accesos.filter(a => a.id !== id);
    guardarAccesos(accesos);
    return true;
});

// ==========================================
// INICIAR APP
// ==========================================
app.whenReady().then(async () => {
    await inicializarSGDB();
    crearVentana();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cerrando-app');
    }
});