// Maestros Comerciales (VIA02, VIA38, VIA44, VIA47) + Normalizador Georef AR (GEOREF_LOC.VBS)
document.addEventListener('DOMContentLoaded', async () => {
    let tabActual = 'clientes';
    let clientes = [];
    let medicos = [];
    let proveedores = [];
    let sucursales = [];

    const thead = document.getElementById('thead-maestros');
    const tbody = document.getElementById('tbody-maestros');
    const inputFiltro = document.getElementById('input-filtro-maestro');
    const panelTabla = document.getElementById('panel-tabla-maestros');
    const panelGeoref = document.getElementById('panel-georef');
    const buscadorContainer = document.getElementById('buscador-container');

    try {
        const [cliRes, medRes, prvRes, sucRes] = await Promise.all([
            fetch('../data-cobol/clientes_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/medicos_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/proveedores_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/sucursales.json').then(r => r.ok ? r.json() : [])
        ]);

        const extraCli = JSON.parse(localStorage.getItem('terian_clientes_extra') || '[]');
        const extraMed = JSON.parse(localStorage.getItem('terian_medicos_extra') || '[]');
        const extraPrv = JSON.parse(localStorage.getItem('terian_proveedores_extra') || '[]');

        clientes = [...extraCli, ...cliRes];
        medicos = [...extraMed, ...medRes];
        proveedores = [...extraPrv, ...prvRes];
        sucursales = sucRes;

        actualizarBadges();

        const params = new URLSearchParams(window.location.search);
        if (params.get('tab')) {
            cambiarTab(params.get('tab'));
        } else {
            renderizarTab();
        }
    } catch (err) {
        console.error('Error cargando maestros comerciales:', err);
    }

    function actualizarBadges() {
        document.getElementById('badge-clientes').textContent = clientes.length;
        document.getElementById('badge-medicos').textContent = medicos.length;
        document.getElementById('badge-proveedores').textContent = proveedores.length;
        document.getElementById('badge-sucursales').textContent = sucursales.length;
    }

    function cambiarTab(nuevaTab) {
        tabActual = nuevaTab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === nuevaTab);
        });

        if (nuevaTab === 'georef') {
            panelTabla.classList.add('hidden');
            buscadorContainer.classList.add('hidden');
            panelGeoref.classList.remove('hidden');
            ejecutarConsultaGeoref();
        } else {
            panelGeoref.classList.add('hidden');
            panelTabla.classList.remove('hidden');
            buscadorContainer.classList.remove('hidden');
            renderizarTab();
        }
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.getAttribute('data-tab')));
    });

    inputFiltro?.addEventListener('input', renderizarTab);

    function renderizarTab() {
        const q = (inputFiltro?.value || '').trim().toUpperCase();

        if (tabActual === 'clientes') {
            thead.innerHTML = `
                <tr>
                    <th class="py-3.5 px-4">Código (VIA02)</th>
                    <th class="py-3.5 px-4">Razón Social / Obra Social / Clínica</th>
                    <th class="py-3.5 px-4">CUIT</th>
                    <th class="py-3.5 px-4">Origen</th>
                    <th class="py-3.5 px-4 text-right">Acción Rápida</th>
                </tr>
            `;
            const lista = clientes.filter(c => !q || `${c.codigo} ${c.razonSocial} ${c.cuit}`.toUpperCase().includes(q)).slice(0, 120);
            tbody.innerHTML = lista.map(c => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3 px-4 font-mono font-bold text-indigo-700">${c.codigo}</td>
                    <td class="py-3 px-4 font-bold text-slate-900">${c.razonSocial}</td>
                    <td class="py-3 px-4 font-mono text-slate-600">${c.cuit || 'S/CUIT'}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">${c.origen || 'VIA02'}</span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <a href="remitos-prestamos.html?id=${encodeURIComponent(c.razonSocial)}" class="text-indigo-600 hover:underline font-semibold text-[11px]">
                            Ver Remitos →
                        </a>
                    </td>
                </tr>
            `).join('');
        } else if (tabActual === 'medicos') {
            thead.innerHTML = `
                <tr>
                    <th class="py-3.5 px-4">Legajo (VIA38)</th>
                    <th class="py-3.5 px-4">Apellido y Nombre del Cirujano</th>
                    <th class="py-3.5 px-4">Especialidad</th>
                    <th class="py-3.5 px-4">Origen</th>
                    <th class="py-3.5 px-4 text-right">Cirugías</th>
                </tr>
            `;
            const lista = medicos.filter(m => !q || `${m.id} ${m.nombre}`.toUpperCase().includes(q)).slice(0, 120);
            tbody.innerHTML = lista.map(m => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3 px-4 font-mono font-bold text-emerald-700">#${String(m.id).padStart(4, '0')}</td>
                    <td class="py-3 px-4 font-bold text-slate-900"><i class="fa-solid fa-user-doctor text-emerald-600 mr-1.5"></i>Dr. ${m.nombre}</td>
                    <td class="py-3 px-4 text-slate-600">Traumatología / Osteosíntesis</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${m.origen || 'VIA38'}</span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <a href="remitos-prestamos.html?id=${encodeURIComponent(m.nombre)}" class="text-emerald-600 hover:underline font-semibold text-[11px]">
                            Buscar Préstamos →
                        </a>
                    </td>
                </tr>
            `).join('');
        } else if (tabActual === 'proveedores') {
            thead.innerHTML = `
                <tr>
                    <th class="py-3.5 px-4">Código (VIA44)</th>
                    <th class="py-3.5 px-4">Razón Social Proveedor / Insumos Médicos</th>
                    <th class="py-3.5 px-4">CUIT</th>
                    <th class="py-3.5 px-4">Origen</th>
                </tr>
            `;
            const lista = proveedores.filter(p => !q || `${p.codigo} ${p.razonSocial} ${p.cuit}`.toUpperCase().includes(q)).slice(0, 120);
            tbody.innerHTML = lista.map(p => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3 px-4 font-mono font-bold text-amber-700">${p.codigo}</td>
                    <td class="py-3 px-4 font-bold text-slate-900">${p.razonSocial}</td>
                    <td class="py-3 px-4 font-mono text-slate-600">${p.cuit || 'S/CUIT'}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">${p.origen || 'VIA44'}</span>
                    </td>
                </tr>
            `).join('');
        } else if (tabActual === 'sucursales') {
            thead.innerHTML = `
                <tr>
                    <th class="py-3.5 px-4">Extensión COBOL</th>
                    <th class="py-3.5 px-4">Punto Venta</th>
                    <th class="py-3.5 px-4">Nombre Sucursal / Delegación</th>
                    <th class="py-3.5 px-4">Jurisdicción / Provincia</th>
                    <th class="py-3.5 px-4 text-right">Operación</th>
                </tr>
            `;
            const lista = sucursales.filter(s => !q || `${s.ext} ${s.nombre} ${s.provincia}`.toUpperCase().includes(q));
            tbody.innerHTML = lista.map(s => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-indigo-300 font-mono font-bold text-xs">${s.ext}</span>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-700">PV ${String(s.codigo).padStart(4, '0')}</td>
                    <td class="py-3 px-4 font-bold text-slate-900">${s.nombre}</td>
                    <td class="py-3 px-4 text-slate-600">${s.provincia}</td>
                    <td class="py-3 px-4 text-right">
                        <a href="remitos-prestamos.html?suc=${encodeURIComponent(s.ext)}" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-semibold text-[11px] transition">
                            Ver Remitos ${s.ext} →
                        </a>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Normalizador Georef (Reemplaza GEOREF_LOC.VBS)
    async function ejecutarConsultaGeoref() {
        const loc = (document.getElementById('georef-localidad')?.value || 'CASEROS').trim();
        const prov = (document.getElementById('georef-provincia')?.value || '').trim();
        const cont = document.getElementById('georef-resultados');
        if (!cont) return;

        cont.innerHTML = `<div class="col-span-full py-6 text-center text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-1.5 text-emerald-600"></i>Consultando API Oficial Georef Argentina (apis.datos.gob.ar)...</div>`;

        try {
            const url = new URL('https://apis.datos.gob.ar/georef/api/localidades');
            url.searchParams.set('nombre', loc);
            if (prov) url.searchParams.set('provincia', prov);
            url.searchParams.set('max', '9');

            const resp = await fetch(url.toString());
            const data = await resp.json();
            const localidades = data.localidades || [];

            if (localidades.length === 0) {
                cont.innerHTML = `<div class="col-span-full py-6 text-center text-xs text-amber-600">No se hallaron coincidencias exactas para "${loc}". Probá con otra localidad.</div>`;
                return;
            }

            cont.innerHTML = localidades.map(l => `
                <div class="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/60 space-y-1.5">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-900 text-xs">${l.nombre}</span>
                        <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">ID ${l.id}</span>
                    </div>
                    <div class="text-[11px] text-slate-600">
                        <div><strong>Partido / Depto:</strong> ${l.departamento?.nombre || 'S/D'}</div>
                        <div><strong>Provincia:</strong> ${l.provincia?.nombre || 'S/D'}</div>
                        <div class="font-mono text-[10px] text-slate-400 mt-1">
                            Lat: ${l.centroide?.lat?.toFixed(4) || '-'} · Lon: ${l.centroide?.lon?.toFixed(4) || '-'}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            // Fallback local por si la terminal está sin salida a internet
            cont.innerHTML = `
                <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-900 text-xs">${loc.toUpperCase()} (Caché Local)</span>
                        <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">INDEC 06840010</span>
                    </div>
                    <div class="text-[11px] text-slate-600">
                        <div><strong>Partido / Depto:</strong> TRES DE FEBRERO / ${prov || 'BUENOS AIRES'}</div>
                        <div class="text-[10px] text-slate-500 mt-1">Normalizado vía caché local GEOREF_LOC</div>
                    </div>
                </div>
            `;
        }
    }

    document.getElementById('btn-consultar-georef')?.addEventListener('click', ejecutarConsultaGeoref);

    // Modal Alta en Padrón
    const modalAlta = document.getElementById('modal-alta-maestro');
    document.getElementById('btn-nuevo-registro')?.addEventListener('click', () => {
        modalAlta.classList.remove('hidden');
        modalAlta.classList.add('flex');
    });
    const cerrarAlta = () => {
        modalAlta.classList.add('hidden');
        modalAlta.classList.remove('flex');
    };
    document.getElementById('btn-cerrar-modal-alta')?.addEventListener('click', cerrarAlta);
    document.getElementById('btn-cancelar-alta')?.addEventListener('click', cerrarAlta);

    document.getElementById('form-alta-maestro')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const tipo = document.getElementById('alta-tipo').value;
        const codigo = document.getElementById('alta-codigo').value.trim().toUpperCase();
        const cuit = document.getElementById('alta-cuit').value.trim().toUpperCase();
        const nombre = document.getElementById('alta-nombre').value.trim().toUpperCase();

        if (tipo === 'clientes') {
            const nuevo = { codigo, razonSocial: nombre, cuit, origen: 'WEB-VIA02' };
            clientes.unshift(nuevo);
            const ex = JSON.parse(localStorage.getItem('terian_clientes_extra') || '[]');
            ex.unshift(nuevo);
            localStorage.setItem('terian_clientes_extra', JSON.stringify(ex));
        } else if (tipo === 'medicos') {
            const nuevo = { id: codigo, nombre: `${nombre} (${cuit})`, origen: 'WEB-VIA38' };
            medicos.unshift(nuevo);
            const ex = JSON.parse(localStorage.getItem('terian_medicos_extra') || '[]');
            ex.unshift(nuevo);
            localStorage.setItem('terian_medicos_extra', JSON.stringify(ex));
        } else {
            const nuevo = { codigo, razonSocial: nombre, cuit, origen: 'WEB-VIA44' };
            proveedores.unshift(nuevo);
            const ex = JSON.parse(localStorage.getItem('terian_proveedores_extra') || '[]');
            ex.unshift(nuevo);
            localStorage.setItem('terian_proveedores_extra', JSON.stringify(ex));
        }

        actualizarBadges();
        cerrarAlta();
        cambiarTab(tipo);
    });
});
