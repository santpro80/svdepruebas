// Órdenes de Compra & Proveedores (Unificación PEDIDOS DE COMPRA React + pedidos-internos + VIA44 COBOL)
document.addEventListener('DOMContentLoaded', async () => {
    let proveedores = [];
    let ordenes = [];
    let ocActual = null;

    const inputBuscar = document.getElementById('input-buscar-oc');
    const selectSector = document.getElementById('select-sector-oc');
    const selectEstado = document.getElementById('select-estado-oc');
    const tbodyOc = document.getElementById('tbody-oc');

    const modalNuevaOc = document.getElementById('modal-nueva-oc');
    const modalPrintOc = document.getElementById('modal-print-oc');

    function fmtMoneda(val) {
        return '$' + Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    try {
        const resPrv = await fetch('../data-cobol/proveedores_cobol.json').then(r => r.ok ? r.json() : []);
        proveedores = resPrv;

        const dl = document.getElementById('dl-proveedores-oc');
        if (dl) {
            dl.innerHTML = proveedores.slice(0, 180).map(p =>
                `<option value="${p.razonSocial} (${p.cuit || p.codigo})">`
            ).join('');
        }

        // Generar OCs iniciales reales vinculadas a los proveedores de VIA44
        const insumosSeed = [
            { sector: 'MECANIZADO CNC / TORNERIA', prioridad: 'URGENTE_PLANTA', cantidad: '120 KG', importe: 3480000, detalle: 'BARRAS TITANIO GRADO 5 ELI (ASTM F136) DIAM. 10MM Y 14MM P/ TORNILLOS CANULADOS' },
            { sector: 'MECANIZADO CNC / TORNERIA', prioridad: 'ALTA', cantidad: '85 KG', importe: 1920000, detalle: 'ACERO INOXIDABLE QUIRURGICO 316LVM (ASTM F138) EN PLANCHUELAS P/ PLACAS BLOQUEADAS' },
            { sector: 'ESTERILIZACION Y PACKAGING', prioridad: 'ALTA', cantidad: '5.000 UN', importe: 680000, detalle: 'BLISTERS DOBLE POUCH GRADO MEDICO APTO RADIACION GAMMA / ETO ANMAT' },
            { sector: 'ARMADO DE CAJAS QUIRURGICAS', prioridad: 'NORMAL', cantidad: '25 CAJAS', importe: 2150000, detalle: 'BANDEJAS Y CAJAS DE ALUMINIO ANODIZADO PERFORADAS P/ OSTEOSINTESIS VOLAR 3.5MM' },
            { sector: 'CALIDAD Y METROLOGIA', prioridad: 'NORMAL', cantidad: '12 UN', importe: 540000, detalle: 'CALIBRES PASA / NO-PASA ROSCA CORTICAL Y ESPONJOSA HA 3.5 / HB 4.0' },
            { sector: 'MECANIZADO CNC / TORNERIA', prioridad: 'URGENTE_PLANTA', cantidad: '40 UN', importe: 890000, detalle: 'INSERTOS DE METAL DURO Y FRESAS MICRO-GRANO P/ CENTRO DE MECANIZADO' },
            { sector: 'ESTERILIZACION Y PACKAGING', prioridad: 'NORMAL', cantidad: '20 ROLLOS', importe: 310000, detalle: 'ETIQUETAS TERMOCONTRAIBLES OPP P/ IMPRESORA ZEBRA ZPL 100X38MM' },
            { sector: 'ARMADO DE CAJAS QUIRURGICAS', prioridad: 'ALTA', cantidad: '60 UN', importe: 1240000, detalle: 'MECHAS QUIRURGICAS ACERO INOX. DIAM. 2.5MM / 2.7MM / 3.2MM ANCLAJE AO' }
        ];

        const baseOrdenes = insumosSeed.map((s, idx) => {
            const p = proveedores[(idx * 5) % Math.max(proveedores.length, 1)] || { codigo: '0010', razonSocial: 'PROVEEDOR INDUSTRIAL S.A.', cuit: '30-70000000-9' };
            const nro = 412 - idx;
            return {
                id: `OC-2026-0${nro}`,
                fecha: `2026-11-0${Math.max(1, 6 - Math.floor(idx / 2))}`,
                proveedorCodigo: p.codigo,
                proveedorNombre: p.razonSocial,
                proveedorCuit: p.cuit || '30-70000000-9',
                sector: s.sector,
                prioridad: s.prioridad,
                cantidad: s.cantidad,
                importe: s.importe,
                detalle: s.detalle,
                estado: idx < 3 ? 'APROBADA_ENVIADA' : idx < 5 ? 'PENDIENTE_APROBACION' : 'RECIBIDA_DEPOSITO'
            };
        });

        const guardadas = JSON.parse(localStorage.getItem('terian_oc_nuevas') || '[]');
        const estadosOverride = JSON.parse(localStorage.getItem('terian_oc_estados') || '{}');

        ordenes = [...guardadas, ...baseOrdenes].map(o => ({
            ...o,
            estado: estadosOverride[o.id] || o.estado
        }));

        renderizar();
    } catch (err) {
        console.error('Error en ordenes-compra-proveedores:', err);
    }

    function renderizar() {
        const q = (inputBuscar?.value || '').trim().toUpperCase();
        const sec = selectSector?.value || 'TODOS';
        const est = selectEstado?.value || 'TODOS';

        const filtradas = ordenes.filter(o => {
            if (sec !== 'TODOS' && o.sector !== sec) return false;
            if (est !== 'TODOS' && o.estado !== est) return false;
            if (q && !`${o.id} ${o.proveedorNombre} ${o.proveedorCuit} ${o.detalle} ${o.sector}`.toUpperCase().includes(q)) return false;
            return true;
        });

        // KPIs
        document.getElementById('kpi-oc-total').textContent = ordenes.length;
        document.getElementById('kpi-oc-pendientes').textContent = `${ordenes.filter(x => x.estado !== 'RECIBIDA_DEPOSITO').length} en gestión`;
        document.getElementById('kpi-prov-total').textContent = proveedores.length || 200;
        const montoTotal = ordenes.reduce((acc, x) => acc + Number(x.importe || 0), 0);
        document.getElementById('kpi-oc-monto').textContent = fmtMoneda(montoTotal);
        document.getElementById('kpi-oc-recibidas').textContent = ordenes.filter(x => x.estado === 'RECIBIDA_DEPOSITO').length;

        tbodyOc.innerHTML = filtradas.map(o => {
            const badgeEstado = o.estado === 'RECIBIDA_DEPOSITO'
                ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">RECIBIDA EN DEPÓSITO</span>'
                : o.estado === 'APROBADA_ENVIADA'
                    ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">APROBADA / ENVIADA</span>'
                    : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">PEND. APROBACIÓN</span>';

            const badgePrio = o.prioridad === 'URGENTE_PLANTA'
                ? '<span class="text-[10px] font-bold text-rose-600"><i class="fa-solid fa-fire mr-1"></i>URGENTE PLANTA</span>'
                : o.prioridad === 'ALTA'
                    ? '<span class="text-[10px] font-bold text-amber-600">PRIORIDAD ALTA</span>'
                    : '<span class="text-[10px] font-semibold text-slate-400">NORMAL</span>';

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3.5 px-4">
                        <div class="font-mono font-bold text-indigo-700">${o.id}</div>
                        <div class="text-[10px] text-slate-400">Cant: <strong class="text-slate-700">${o.cantidad}</strong></div>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-mono text-[11px] text-slate-700">${o.fecha}</div>
                        <div>${badgePrio}</div>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-900 truncate max-w-[220px]">${o.proveedorNombre}</div>
                        <div class="font-mono text-[10px] text-slate-500">CUIT: ${o.proveedorCuit} · VIA44 #${o.proveedorCodigo}</div>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="text-[10px] font-bold uppercase text-indigo-600">${o.sector}</div>
                        <div class="text-slate-700 truncate max-w-[280px]" title="${o.detalle}">${o.detalle}</div>
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono font-black text-slate-900">${fmtMoneda(o.importe)}</td>
                    <td class="py-3.5 px-4 text-center">${badgeEstado}</td>
                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                        <button data-oc-id="${o.id}" class="btn-ver-oc px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-semibold text-[11px] transition">
                            <i class="fa-solid fa-eye mr-1"></i>Ver / Recibir
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-ver-oc').forEach(btn => {
            btn.addEventListener('click', () => {
                const found = ordenes.find(x => x.id === btn.getAttribute('data-oc-id'));
                if (found) abrirDetalleOc(found);
            });
        });
    }

    function abrirDetalleOc(o) {
        ocActual = o;
        document.getElementById('po-header-id').textContent = o.id;
        document.getElementById('po-numero').textContent = o.id;
        document.getElementById('po-fecha').textContent = o.fecha;
        document.getElementById('po-proveedor').textContent = o.proveedorNombre;
        document.getElementById('po-cuit').textContent = `CUIT: ${o.proveedorCuit} (Código VIA44: ${o.proveedorCodigo})`;
        document.getElementById('po-sector').textContent = o.sector;
        document.getElementById('po-prioridad').textContent = `Prioridad: ${o.prioridad}`;
        document.getElementById('po-detalle').textContent = o.detalle;
        document.getElementById('po-cantidad').textContent = o.cantidad;
        document.getElementById('po-importe').textContent = fmtMoneda(o.importe);

        modalPrintOc.classList.remove('hidden');
        modalPrintOc.classList.add('flex');
    }

    [inputBuscar, selectSector, selectEstado].forEach(el => {
        el?.addEventListener('input', renderizar);
        el?.addEventListener('change', renderizar);
    });

    document.getElementById('btn-cerrar-print-oc')?.addEventListener('click', () => {
        modalPrintOc.classList.add('hidden');
        modalPrintOc.classList.remove('flex');
    });

    document.getElementById('btn-recibir-mp')?.addEventListener('click', () => {
        if (!ocActual) return;
        ocActual.estado = 'RECIBIDA_DEPOSITO';
        const estadosOverride = JSON.parse(localStorage.getItem('terian_oc_estados') || '{}');
        estadosOverride[ocActual.id] = 'RECIBIDA_DEPOSITO';
        localStorage.setItem('terian_oc_estados', JSON.stringify(estadosOverride));
        renderizar();
        modalPrintOc.classList.add('hidden');
        modalPrintOc.classList.remove('flex');
    });

    // Abrir/cerrar Nueva OC
    document.getElementById('btn-nueva-oc')?.addEventListener('click', () => {
        modalNuevaOc.classList.remove('hidden');
        modalNuevaOc.classList.add('flex');
    });
    const cerrarNuevaOc = () => {
        modalNuevaOc.classList.add('hidden');
        modalNuevaOc.classList.remove('flex');
    };
    document.getElementById('btn-cerrar-modal-oc')?.addEventListener('click', cerrarNuevaOc);
    document.getElementById('btn-cancelar-oc')?.addEventListener('click', cerrarNuevaOc);

    document.getElementById('form-nueva-oc')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const provRaw = document.getElementById('oc-proveedor').value.trim().toUpperCase();
        const sector = document.getElementById('oc-sector').value;
        const prioridad = document.getElementById('oc-prioridad').value;
        const cantidad = document.getElementById('oc-cantidad').value.trim().toUpperCase();
        const importe = parseFloat(document.getElementById('oc-importe').value) || 0;
        const detalle = document.getElementById('oc-detalle').value.trim().toUpperCase();

        const nuevoNro = 413 + ordenes.length;
        const nueva = {
            id: `OC-2026-0${nuevoNro}`,
            fecha: new Date().toISOString().slice(0, 10),
            proveedorCodigo: 'WEB',
            proveedorNombre: provRaw,
            proveedorCuit: '30-70000000-9',
            sector,
            prioridad,
            cantidad,
            importe,
            detalle,
            estado: 'APROBADA_ENVIADA'
        };

        const guardadas = JSON.parse(localStorage.getItem('terian_oc_nuevas') || '[]');
        guardadas.unshift(nueva);
        localStorage.setItem('terian_oc_nuevas', JSON.stringify(guardadas));

        ordenes.unshift(nueva);
        cerrarNuevaOc();
        renderizar();
        abrirDetalleOc(nueva);
    });
});
