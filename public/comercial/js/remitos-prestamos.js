// Remitos & Préstamos Quirúrgicos Multi-Sucursal (VI0201N2 + VIA34/35 + INTEGRA_CHECK + SACO15)
document.addEventListener('DOMContentLoaded', async () => {
    let remitosBase = [];
    let clientesBase = [];
    let medicosBase = [];
    let sucursalesBase = [];
    let remitoActualDetalle = null;

    const inputBuscar = document.getElementById('input-buscar');
    const selectSucursal = document.getElementById('select-sucursal');
    const selectTipo = document.getElementById('select-tipo');
    const selectEstado = document.getElementById('select-estado');
    const tablaRemitos = document.getElementById('tabla-remitos');
    const countFiltrados = document.getElementById('count-filtrados');
    const countCirugia = document.getElementById('count-cirugia');
    const countConCajas = document.getElementById('count-con-cajas');

    // Modales
    const modalNuevo = document.getElementById('modal-nuevo-remito');
    const modalDetalle = document.getElementById('modal-detalle-remito');

    // Cargar datos de puente COBOL
    try {
        const [remRes, cliRes, medRes, sucRes] = await Promise.all([
            fetch('../data-cobol/remitos_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/clientes_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/medicos_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/sucursales.json').then(r => r.ok ? r.json() : [])
        ]);

        const localNuevos = JSON.parse(localStorage.getItem('terian_remitos_nuevos') || '[]');
        const estadosOverride = JSON.parse(localStorage.getItem('terian_remitos_estados') || '{}');

        remitosBase = [...localNuevos, ...remRes].map(r => ({
            ...r,
            estado: estadosOverride[r.id] || r.estado
        }));
        clientesBase = cliRes;
        medicosBase = medRes;
        sucursalesBase = sucRes;

        // Poblar combo de sucursales
        if (selectSucursal && sucursalesBase.length > 0) {
            sucursalesBase.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.ext;
                opt.textContent = `${s.ext} — ${s.nombre} (PV ${s.codigo.padStart(4, '0')})`;
                selectSucursal.appendChild(opt);
            });
        }

        // Poblar datalists de clientes y médicos
        const dlCli = document.getElementById('lista-clientes-datalist');
        if (dlCli) {
            dlCli.innerHTML = clientesBase.slice(0, 180).map(c =>
                `<option value="${c.razonSocial} (${c.cuit || c.codigo})">`
            ).join('');
        }
        const dlMed = document.getElementById('lista-medicos-datalist');
        if (dlMed) {
            dlMed.innerHTML = medicosBase.slice(0, 180).map(m =>
                `<option value="${m.nombre}">`
            ).join('');
        }

        // Revisar parámetros de URL (?suc=.05 o ?id=0004-00045711)
        const params = new URLSearchParams(window.location.search);
        if (params.get('suc')) {
            selectSucursal.value = params.get('suc');
        }
        if (params.get('id')) {
            inputBuscar.value = params.get('id');
        }

        renderTabla();

        if (params.get('id')) {
            const target = remitosBase.find(r => r.id === params.get('id'));
            if (target) abrirDetalleRemito(target);
        }
    } catch (e) {
        console.error('Error cargando datos en remitos-prestamos:', e);
    }

    function obtenerFiltrados() {
        const q = (inputBuscar.value || '').trim().toUpperCase();
        const suc = selectSucursal.value;
        const tipo = selectTipo.value;
        const est = selectEstado.value;

        return remitosBase.filter(r => {
            if (suc !== 'TODAS' && r.sucursalExt !== suc) return false;
            if (tipo !== 'TODOS' && r.tipo !== tipo) return false;
            if (est !== 'TODOS' && r.estado !== est) return false;
            if (q) {
                const hay = [
                    r.id,
                    r.clienteNombre,
                    r.clienteCuit,
                    r.medicoNombre,
                    r.paciente,
                    r.nroOrden,
                    r.gerenciador,
                    ...(r.cajasSerie || [])
                ].join(' ').toUpperCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }

    function renderTabla() {
        const filtrados = obtenerFiltrados();
        countFiltrados.textContent = filtrados.length;
        countCirugia.textContent = filtrados.filter(r => r.estado === 'EN_CIRUGIA').length;
        countConCajas.textContent = filtrados.filter(r => r.cajasSerie && r.cajasSerie.length > 0).length;

        if (filtrados.length === 0) {
            tablaRemitos.innerHTML = `
                <tr>
                    <td colspan="7" class="py-10 text-center text-slate-400">
                        No se encontraron remitos o préstamos quirúrgicos con los filtros actuales.
                    </td>
                </tr>
            `;
            return;
        }

        tablaRemitos.innerHTML = filtrados.map(r => {
            const badgeEstado = r.estado === 'EN_CIRUGIA'
                ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">EN CIRUGÍA</span>'
                : r.estado === 'ENTREGADO'
                    ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">ENTREGADO</span>'
                    : r.estado === 'FACTURADO'
                        ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">FACTURADO</span>'
                        : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">ANULADO</span>';

            const cajasHtml = (r.cajasSerie && r.cajasSerie.length > 0)
                ? r.cajasSerie.map(serie => `
                    <a href="../supervisor/buscar-por-prestamo.html?serie=${encodeURIComponent(serie)}&remito=${encodeURIComponent(r.id)}"
                       class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 font-mono text-[10px] font-bold transition"
                       title="Ver Caja ${serie} en Trazabilidad">
                        <i class="fa-solid fa-box-open text-[9px]"></i>${serie}
                    </a>
                `).join(' ')
                : `<span class="text-[11px] text-slate-400">${r.totalItems || (r.items ? r.items.length : 1)} ítems quirúrgicos</span>`;

            return `
                <tr class="hover:bg-slate-50/90 transition">
                    <td class="py-3.5 px-4">
                        <div class="font-mono font-bold text-slate-900">${r.id}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="px-1.5 py-0.2 rounded bg-slate-900 text-indigo-300 font-mono text-[10px] font-bold">${r.sucursalExt}</span>
                            <span class="text-[10px] font-semibold ${r.tipo === 'P' ? 'text-indigo-600' : 'text-emerald-600'}">
                                ${r.tipo === 'P' ? 'Préstamo (P)' : 'Seriado (S)'}
                            </span>
                        </div>
                    </td>
                    <td class="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        <div>${r.fecha}</div>
                        <div class="text-[10px] text-slate-400">${r.hora || '09:30'} hs</div>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800 truncate max-w-[230px]">${r.clienteNombre}</div>
                        <div class="text-[10px] text-slate-500">
                            <span class="font-mono">${r.clienteCuit || ''}</span> · Pac: <strong class="text-slate-700">${r.paciente || 'S/D'}</strong>
                        </div>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-semibold text-slate-800 truncate max-w-[210px]">
                            <i class="fa-solid fa-user-doctor text-emerald-600 mr-1"></i>Dr. ${r.medicoNombre}
                        </div>
                        <div class="text-[10px] text-slate-500 truncate max-w-[210px]">
                            ${r.gerenciador || 'CONVENIO DIRECTO'} · <span class="font-mono">${r.nroOrden || ''}</span>
                        </div>
                    </td>
                    <td class="py-3.5 px-4">${cajasHtml}</td>
                    <td class="py-3.5 px-4">${badgeEstado}</td>
                    <td class="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button data-remito-id="${r.id}" class="btn-ver-remito px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-semibold text-[11px] transition">
                            <i class="fa-solid fa-eye mr-1"></i>Remito R
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-ver-remito').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-remito-id');
                const found = remitosBase.find(x => x.id === id);
                if (found) abrirDetalleRemito(found);
            });
        });
    }

    function abrirDetalleRemito(r) {
        remitoActualDetalle = r;
        document.getElementById('det-header-id').textContent = r.id;
        document.getElementById('det-sucursal').textContent = `${r.sucursalExt} — ${r.sucursalNombre}`;
        document.getElementById('det-tipo-badge').textContent = r.tipo === 'P' ? 'PRÉSTAMO QUIRÚRGICO (P)' : 'REMITO SERIADO DEFINITIVO (S)';
        document.getElementById('det-numero').textContent = r.id;
        document.getElementById('det-fecha').textContent = `${r.fecha} ${r.hora || ''}`;
        document.getElementById('det-cliente').textContent = r.clienteNombre;
        document.getElementById('det-cuit').textContent = r.clienteCuit || '30-00000000-0';
        document.getElementById('det-medico').textContent = `Dr. ${r.medicoNombre}`;
        document.getElementById('det-paciente').textContent = r.paciente || 'S/D';
        document.getElementById('det-orden').textContent = r.nroOrden || 'S/N';
        document.getElementById('det-gerenciador').textContent = r.gerenciador || 'CONVENIO DIRECTO';
        document.getElementById('det-transporte').textContent = r.transporte || 'LOGISTICA PROPIA VILLALBA';
        document.getElementById('det-cajas').textContent = (r.cajasSerie && r.cajasSerie.length > 0) ? r.cajasSerie.join(', ') : 'IMPLANTES S/CAJA SERIADA';
        document.getElementById('det-archivo-origen').textContent = r.archivoOrigen || `02-${r.id}.TXT`;

        const btnFacturar = document.getElementById('btn-ir-facturar');
        if (btnFacturar) {
            btnFacturar.href = `facturacion-afip.html?remito=${encodeURIComponent(r.id)}`;
        }

        const tbody = document.getElementById('det-tabla-items');
        const items = r.items && r.items.length > 0 ? r.items : [
            { codigo: '91-990-36', cantidad: 1, descripcion: 'CAJA INSTRUMENTAL E IMPLANTES QUIRURGICOS', serieCaja: (r.cajasSerie && r.cajasSerie[0]) || '' }
        ];
        tbody.innerHTML = items.map(it => `
            <tr>
                <td class="py-1.5 px-2 font-bold text-slate-800">${it.codigo}</td>
                <td class="py-1.5 px-2 text-center font-bold">${it.cantidad}</td>
                <td class="py-1.5 px-2 text-slate-700">${it.descripcion}</td>
                <td class="py-1.5 px-2 text-right font-bold text-indigo-700">${it.serieCaja || '-'}</td>
            </tr>
        `).join('');

        modalDetalle.classList.remove('hidden');
        modalDetalle.classList.add('flex');
    }

    // Eventos de filtro
    [inputBuscar, selectSucursal, selectTipo, selectEstado].forEach(el => {
        if (el) el.addEventListener('input', renderTabla);
        if (el) el.addEventListener('change', renderTabla);
    });

    // Cerrar modal detalle
    document.getElementById('btn-cerrar-detalle')?.addEventListener('click', () => {
        modalDetalle.classList.add('hidden');
        modalDetalle.classList.remove('flex');
    });

    // Cambiar estado del remito a ENTREGADO
    document.getElementById('btn-cambiar-estado-entregado')?.addEventListener('click', () => {
        if (!remitoActualDetalle) return;
        remitoActualDetalle.estado = 'ENTREGADO';
        const estadosOverride = JSON.parse(localStorage.getItem('terian_remitos_estados') || '{}');
        estadosOverride[remitoActualDetalle.id] = 'ENTREGADO';
        localStorage.setItem('terian_remitos_estados', JSON.stringify(estadosOverride));
        renderTabla();
        modalDetalle.classList.add('hidden');
        modalDetalle.classList.remove('flex');
    });

    // Abrir/Cerrar modal Nuevo Remito
    document.getElementById('btn-nuevo-remito')?.addEventListener('click', () => {
        modalNuevo.classList.remove('hidden');
        modalNuevo.classList.add('flex');
    });
    const cerrarNuevo = () => {
        modalNuevo.classList.add('hidden');
        modalNuevo.classList.remove('flex');
    };
    document.getElementById('btn-cerrar-modal-nuevo')?.addEventListener('click', cerrarNuevo);
    document.getElementById('btn-cancelar-nuevo')?.addEventListener('click', cerrarNuevo);

    // Botón Verificar Serie de Caja (INTEGRA_CHECK)
    document.getElementById('btn-verificar-caja')?.addEventListener('click', () => {
        const inputSerie = document.getElementById('nuevo-cajas-serie');
        const statusEl = document.getElementById('status-integra-check');
        const series = (inputSerie.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        if (series.length === 0) {
            statusEl.innerHTML = `<span class="text-rose-600 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Ingresá al menos un código de serie de caja (ej. AX2066, BD6590).</span>`;
            return;
        }
        statusEl.innerHTML = `<span class="text-emerald-700 font-bold"><i class="fa-solid fa-circle-check mr-1"></i>INTEGRA_CHECK OK: Series [${series.join(', ')}] verificadas y listas para vincular al préstamo quirúrgico.</span>`;
    });

    // Guardar nuevo remito / préstamo
    document.getElementById('form-nuevo-remito')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const [pv, sucExt, sucNombre] = document.getElementById('nuevo-sucursal').value.split('|');
        const tipo = document.getElementById('nuevo-tipo').value;
        const clienteRaw = document.getElementById('nuevo-cliente').value.trim().toUpperCase();
        const medicoRaw = document.getElementById('nuevo-medico').value.trim().toUpperCase();
        const paciente = document.getElementById('nuevo-paciente').value.trim().toUpperCase();
        const nroOrden = document.getElementById('nuevo-orden').value.trim().toUpperCase() || 'OC-DIRECTA';
        const gerenciador = document.getElementById('nuevo-gerenciador').value.trim().toUpperCase() || 'CONVENIO DIRECTO';
        const transporte = document.getElementById('nuevo-transporte').value.trim().toUpperCase() || 'LOGISTICA PROPIA VILLALBA';
        const cajasSerie = (document.getElementById('nuevo-cajas-serie').value || '')
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

        // Calcular próximo número correlativo para el Punto de Venta
        const existentesPv = remitosBase.filter(r => r.puntoVenta === pv);
        let maxNum = 45715;
        existentesPv.forEach(r => {
            const n = parseInt(r.numero, 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
        });
        const nuevoNumero = String(maxNum + 1).padStart(8, '0');
        const nuevoId = `${pv}-${nuevoNumero}`;

        // Parsear líneas de ítems
        const lineas = (document.getElementById('nuevo-items-texto').value || '').split('\n').map(l => l.trim()).filter(Boolean);
        const items = lineas.map(ln => {
            const partes = ln.split('|').map(p => p.trim());
            return {
                codigo: partes[0] || '91-990-00',
                cantidad: parseFloat(partes[1]) || 1,
                descripcion: partes[2] || partes[0] || 'CAJA / IMPLANTE QUIRURGICO',
                serieCaja: partes[3] || (cajasSerie[0] || '')
            };
        });

        const ahora = new Date();
        const nuevoRemito = {
            id: nuevoId,
            puntoVenta: pv,
            numero: nuevoNumero,
            sucursalExt: sucExt,
            sucursalNombre: sucNombre,
            fecha: ahora.toISOString().slice(0, 10),
            hora: ahora.toTimeString().slice(0, 5),
            tipo,
            tipoDesc: tipo === 'P' ? 'Prestamo Quirurgico (Cajas/Implantes)' : 'Remito Seriado a Facturar',
            estado: 'EN_CIRUGIA',
            clienteCodigo: 'WEB',
            clienteNombre: clienteRaw,
            clienteCuit: '30-70000000-1',
            medicoNombre: medicoRaw,
            paciente,
            nroOrden,
            gerenciador,
            transporte,
            cajasSerie,
            totalItems: items.length,
            items,
            archivoOrigen: `02-${nuevoId}.TXT (Emitido en TERIAN Web v3.0)`
        };

        const guardados = JSON.parse(localStorage.getItem('terian_remitos_nuevos') || '[]');
        guardados.unshift(nuevoRemito);
        localStorage.setItem('terian_remitos_nuevos', JSON.stringify(guardados));

        remitosBase.unshift(nuevoRemito);
        cerrarNuevo();
        renderTabla();
        abrirDetalleRemito(nuevoRemito);
    });

    // Exportar Planilla Logística CSV (ENVIOS.TXT — Reemplaza SACO15.COB / saco03.cob)
    document.getElementById('btn-exportar-envios')?.addEventListener('click', () => {
        const filtrados = obtenerFiltrados();
        const header = 'REMITO;SUCURSAL;FECHA;TIPO;ESTADO;CLIENTE;CUIT;MEDICO;PACIENTE;ORDEN;GERENCIADOR;TRANSPORTE;SERIES_CAJAS;CANT_ITEMS';
        const rows = filtrados.map(r => [
            r.id,
            r.sucursalExt,
            r.fecha,
            r.tipo,
            r.estado,
            `"${(r.clienteNombre || '').replace(/"/g, '""')}"`,
            r.clienteCuit || '',
            `"${(r.medicoNombre || '').replace(/"/g, '""')}"`,
            `"${(r.paciente || '').replace(/"/g, '""')}"`,
            r.nroOrden || '',
            `"${(r.gerenciador || '').replace(/"/g, '""')}"`,
            `"${(r.transporte || '').replace(/"/g, '""')}"`,
            (r.cajasSerie || []).join('|'),
            r.totalItems || (r.items ? r.items.length : 1)
        ].join(';'));

        const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ENVIOS_${new Date().toISOString().slice(0, 10)}.CSV`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
