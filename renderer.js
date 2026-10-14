// ==========================================
// WELCOME AL INICIAR
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const welcome = document.getElementById('welcome-screen');
        const app = document.getElementById('app');
        welcome.classList.add('oculto');
        app.classList.remove('app-hidden');
        setTimeout(() => {
            app.classList.add('app-visible');
        }, 100);
    }, 3000);
});

// ==========================================
// GOODBYE AL CERRAR
// ==========================================
window.api.onCerrando(() => {
    const bye = document.createElement('div');
    bye.id = 'goodbye-screen';
    bye.innerHTML = `
        <div class="goodbye-text">GOODBYE</div>
        <div class="goodbye-line"></div>
    `;
    document.body.appendChild(bye);

    setTimeout(() => {
        window.close();
    }, 2200);
});

// ==========================================
// ESTADO
// ==========================================
let accesos = [];
let categoriaActual = 'todos';
let textoBusqueda = '';
let ordenActual = 'recientes';
let juegosDetectados = [];

// ==========================================
// ELEMENTOS
// ==========================================
const grid = document.getElementById('grid');
const vacio = document.getElementById('vacio');
const buscador = document.getElementById('buscador');
const btnAgregar = document.getElementById('btn-agregar');
const btnDetectar = document.getElementById('btn-detectar');
const btnTema = document.getElementById('btn-tema');
const iconoTema = document.getElementById('icono-tema');
const addDropdown = document.getElementById('add-dropdown');
const filtros = document.querySelectorAll('.filtro');
const ordenar = document.getElementById('ordenar');
const contadorTotal = document.getElementById('contador-total');
const contadorFavoritos = document.getElementById('contador-favoritos');

const modalWeb = document.getElementById('modal-web');
const webNombre = document.getElementById('web-nombre');
const webUrl = document.getElementById('web-url');
const btnCancelarWeb = document.getElementById('btn-cancelar-web');
const btnGuardarWeb = document.getElementById('btn-guardar-web');

const modalDetectar = document.getElementById('modal-detectar');
const detectarResumen = document.getElementById('detectar-resumen');
const detectarLista = document.getElementById('detectar-lista');
const btnCancelarDetectar = document.getElementById('btn-cancelar-detectar');
const btnGuardarDetectar = document.getElementById('btn-guardar-detectar');

const detectarManual = document.getElementById('detectar-manual');
const btnElegirSteam = document.getElementById('btn-elegir-steam');
const btnElegirEpic = document.getElementById('btn-elegir-epic');

const iconos = {
    juego: '🎮',
    web: '🌐',
    carpeta: '📁'
};

// ==========================================
// CARGAR ACCESOS
// ==========================================
async function cargarAccesos() {
    try {
        accesos = await window.api.obtenerAccesos();
        renderizar();
        actualizarContadores();
    } catch (e) {
        console.error('Error:', e);
        accesos = [];
        renderizar();
    }
}

function actualizarContadores() {
    const total = accesos.length;
    const favs = accesos.filter(a => a.favorito).length;
    contadorTotal.textContent = `${total} acceso${total !== 1 ? 's' : ''}`;
    contadorFavoritos.textContent = `${favs} favorito${favs !== 1 ? 's' : ''}`;
}

// ==========================================
// RENDERIZAR (con imágenes)
// ==========================================
function renderizar() {
    let filtrados = accesos.filter(a => {
        const coincideCat = categoriaActual === 'todos' ||
            (categoriaActual === 'Favoritos' && a.favorito) ||
            a.categoria === categoriaActual;
        const coincideTexto = !textoBusqueda ||
            a.nombre.toLowerCase().includes(textoBusqueda.toLowerCase());
        return coincideCat && coincideTexto;
    });

    if (ordenActual === 'nombre') {
        filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (ordenActual === 'usados') {
        filtrados.sort((a, b) => (b.vecesAbierto || 0) - (a.vecesAbierto || 0));
    } else {
        filtrados.sort((a, b) => (b.ultimaVez || 0) - (a.ultimaVez || 0));
    }

    grid.innerHTML = '';

    if (filtrados.length === 0) {
        vacio.style.display = 'block';
        return;
    }
    vacio.style.display = 'none';

    filtrados.forEach((acceso, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.animationDelay = `${i * 30}ms`;

        const fecha = acceso.ultimaVez
            ? new Date(acceso.ultimaVez).toLocaleDateString('es-ES')
            : 'Nunca';
        const veces = acceso.vecesAbierto || 0;
        const launcher = acceso.launcher ? ` · ${acceso.launcher}` : '';

        // Imagen o emoji
        const imagenHTML = acceso.imagen
            ? `<div class="card-imagen"><img src="${acceso.imagen}" alt="${acceso.nombre}" onerror="this.parentElement.outerHTML='<div class=\\'card-icono\\'>${iconos[acceso.tipo] || '📦'}</div>'"></div>`
            : `<div class="card-icono">${iconos[acceso.tipo] || '📦'}</div>`;

        card.innerHTML = `
            <button class="card-favorito ${acceso.favorito ? 'activo' : ''}" title="Favorito">${acceso.favorito ? '⭐' : '☆'}</button>
            <button class="card-eliminar" title="Eliminar">✕</button>
            ${imagenHTML}
            <div class="card-nombre">${acceso.nombre}</div>
            <div class="card-tipo">${acceso.categoria || 'Acceso'}${launcher}</div>
            <div class="card-meta">${veces} usos · ${fecha}</div>
        `;

        card.addEventListener('click', async (e) => {
            if (e.target.classList.contains('card-eliminar') ||
                e.target.classList.contains('card-favorito')) return;
            await window.api.abrirAcceso(acceso);
            cargarAccesos();
        });

        card.querySelector('.card-favorito').addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.api.toggleFavorito(acceso.id);
            cargarAccesos();
        });

        card.querySelector('.card-eliminar').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar "${acceso.nombre}"?`)) {
                await window.api.eliminarAcceso(acceso.id);
                cargarAccesos();
            }
        });

        grid.appendChild(card);
    });
}

// ==========================================
// BOTÓN AÑADIR
// ==========================================
btnAgregar.addEventListener('click', (e) => {
    e.stopPropagation();
    addDropdown.classList.toggle('visible');
});

document.addEventListener('click', () => {
    addDropdown.classList.remove('visible');
});

addDropdown.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tipo = btn.dataset.tipo;

    if (tipo === 'juego' || tipo === 'carpeta') {
        await window.api.agregarAcceso(tipo);
        cargarAccesos();
    }

    if (tipo === 'web') {
        modalWeb.style.display = 'flex';
        webNombre.value = '';
        webUrl.value = '';
        webNombre.focus();
    }

    addDropdown.classList.remove('visible');
});

// ==========================================
// BOTÓN DETECTAR
// ==========================================
async function ejecutarDeteccion() {
    modalDetectar.style.display = 'flex';
    detectarResumen.textContent = 'Escaneando Steam y Epic... Esto puede tardar 1-2 minutos.';
    detectarLista.innerHTML = '<div class="detectar-cargando">⏳ Buscando juegos y portadas...</div>';
    detectarManual.style.display = 'none';

    const resultado = await window.api.detectarJuegos();
    juegosDetectados = resultado.juegos;

    detectarResumen.textContent = `Steam: ${resultado.steam} juegos · Epic: ${resultado.epic} juegos`;

    if (juegosDetectados.length === 0) {
        detectarLista.innerHTML = '<div class="detectar-vacio">No se encontraron juegos.<br><small>Elegí las carpetas manualmente abajo 👇</small></div>';
        detectarManual.style.display = 'block';
        return;
    }

    detectarLista.innerHTML = '';
    juegosDetectados.forEach((juego, i) => {
        const item = document.createElement('label');
        item.className = 'detectar-item';
        item.innerHTML = `
            <input type="checkbox" checked data-index="${i}">
            <span class="detectar-nombre">${juego.nombre}</span>
            <span class="detectar-launcher">${juego.launcher}</span>
        `;
        detectarLista.appendChild(item);
    });
}

btnDetectar.addEventListener('click', ejecutarDeteccion);

btnCancelarDetectar.addEventListener('click', () => {
    modalDetectar.style.display = 'none';
});

btnGuardarDetectar.addEventListener('click', async () => {
    const seleccionados = [];
    detectarLista.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const idx = parseInt(cb.dataset.index);
        if (juegosDetectados[idx]) {
            seleccionados.push(juegosDetectados[idx]);
        }
    });

    if (seleccionados.length === 0) {
        alert('No seleccionaste ningún juego');
        return;
    }

    const agregados = await window.api.agregarDetectados(seleccionados);
    alert(`✅ ${agregados} juegos agregados`);
    modalDetectar.style.display = 'none';
    cargarAccesos();
});

btnElegirSteam.addEventListener('click', async () => {
    const ruta = await window.api.elegirCarpetaSteam();
    if (!ruta) return;
    alert(`✅ Carpeta guardada:\n${ruta}\n\nRe-escaneando...`);
    ejecutarDeteccion();
});

btnElegirEpic.addEventListener('click', async () => {
    const ruta = await window.api.elegirCarpetaEpic();
    if (!ruta) return;
    alert(`✅ Carpeta guardada:\n${ruta}\n\nRe-escaneando...`);
    ejecutarDeteccion();
});

// ==========================================
// MODAL WEB
// ==========================================
btnCancelarWeb.addEventListener('click', () => {
    modalWeb.style.display = 'none';
});

btnGuardarWeb.addEventListener('click', async () => {
    const nombre = webNombre.value.trim();
    let url = webUrl.value.trim();

    if (!nombre || !url) {
        alert('Completá nombre y URL');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    await window.api.agregarWeb({ nombre, url });
    modalWeb.style.display = 'none';
    cargarAccesos();
});

// ==========================================
// TEMA CLARO/OSCURO
// ==========================================
let temaActual = localStorage.getItem('tema') || 'oscuro';
aplicarTema(temaActual);

btnTema.addEventListener('click', () => {
    temaActual = temaActual === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(temaActual);
    localStorage.setItem('tema', temaActual);
});

function aplicarTema(tema) {
    if (tema === 'claro') {
        document.body.classList.add('tema-claro');
        iconoTema.textContent = '☀️';
    } else {
        document.body.classList.remove('tema-claro');
        iconoTema.textContent = '🌙';
    }
}

// ==========================================
// BUSCADOR Y FILTROS
// ==========================================
buscador.addEventListener('input', (e) => {
    textoBusqueda = e.target.value;
    renderizar();
});

filtros.forEach(f => {
    f.addEventListener('click', () => {
        filtros.forEach(x => x.classList.remove('activo'));
        f.classList.add('activo');
        categoriaActual = f.dataset.cat;
        renderizar();
    });
});

ordenar.addEventListener('change', (e) => {
    ordenActual = e.target.value;
    renderizar();
});

// ==========================================
// ATAJOS DE TECLADO
// ==========================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modalWeb.style.display = 'none';
        modalDetectar.style.display = 'none';
        addDropdown.classList.remove('visible');
    }
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        buscador.focus();
    }
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        window.api.agregarAcceso('juego').then(() => cargarAccesos());
    }
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        btnDetectar.click();
    }
});

// ==========================================
// INICIAR
// ==========================================
cargarAccesos();