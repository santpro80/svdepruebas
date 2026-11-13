// Hub Comercial, Logística Multi-Sucursal & Facturación — TERIAN ERP v3.0
document.addEventListener('DOMContentLoaded', async () => {
    const kpiRemitosTotal = document.getElementById('kpi-remitos-total');
    const kpiRemitosCirugia = document.getElementById('kpi-remitos-cirugia');
    const kpiClientesTotal = document.getElementById('kpi-clientes-total');
    const kpiMedicosTotal = document.getElementById('kpi-medicos-total');
    const kpiProveedoresTotal = document.getElementById('kpi-proveedores-total');
    const kpiSucursalesTotal = document.getElementById('kpi-sucursales-total');
    const gridSucursales = document.getElementById('grid-sucursales');
    const tablaUltimosRemitos = document.getElementById('tabla-ultimos-remitos');

    try {
        const [resRemitos, resSucursales, resResumen] = await Promise.all([
            fetch('../data-cobol/remitos_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/sucursales.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/resumen_puente.json').then(r => r.ok ? r.json() : null)
        ]);

        // Combinar con remitos nuevos guardados en localStorage
        const localRemitos = JSON.parse(localStorage.getItem('terian_remitos_nuevos') || '[]');
        const todosRemitos = [...localRemitos, ...resRemitos];

        // KPIs
        if (kpiRemitosTotal) kpiRemitosTotal.textContent = todosRemitos.length;
        const enCirugia = todosRemitos.filter(r => r.estado === 'EN_CIRUGIA').length;
        if (kpiRemitosCirugia) kpiRemitosCirugia.textContent = `${enCirugia} en cirugía activa`;

        if (resResumen) {
            if (kpiClientesTotal && resResumen.clientesExportados) kpiClientesTotal.textContent = resResumen.clientesExportados;
            if (kpiMedicosTotal && resResumen.medicosExportados) kpiMedicosTotal.textContent = resResumen.medicosExportados;
            if (kpiProveedoresTotal && resResumen.proveedoresExportados) {
                kpiProveedoresTotal.textContent = `+ ${resResumen.proveedoresExportados} Proveedores`;
            }
            if (kpiSucursalesTotal && resResumen.sucursalesActivas) kpiSucursalesTotal.textContent = resResumen.sucursalesActivas;
        }

        // Renderizar Sucursales
        if (gridSucursales && resSucursales.length > 0) {
            gridSucursales.innerHTML = resSucursales.map(s => {
                const countSuc = todosRemitos.filter(r => r.sucursalExt === s.ext).length;
                return `
                    <a href="remitos-prestamos.html?suc=${encodeURIComponent(s.ext)}" class="suc-badge flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 transition">
                        <div class="flex items-center gap-2.5">
                            <span class="px-2 py-1 rounded-lg bg-slate-900 text-indigo-300 font-mono text-xs font-bold">${s.ext}</span>
                            <div>
                                <div class="text-xs font-bold text-slate-800">${s.nombre}</div>
                                <div class="text-[10px] text-slate-400">PV ${s.codigo.padStart(4, '0')} · ${s.provincia}</div>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${countSuc > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}">
                            ${countSuc} rem.
                        </span>
                    </a>
                `;
            }).join('');
        }

        // Renderizar Últimos 7 Remitos
        if (tablaUltimosRemitos) {
            const topRemitos = todosRemitos.slice(0, 7);
            tablaUltimosRemitos.innerHTML = topRemitos.map(r => {
                const badgeEstado = r.estado === 'EN_CIRUGIA'
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">EN CIRUGÍA</span>'
                    : r.estado === 'ENTREGADO'
                        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">ENTREGADO</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">FACTURADO</span>';

                const cajasHtml = (r.cajasSerie && r.cajasSerie.length > 0)
                    ? r.cajasSerie.map(c => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] font-bold"><i class="fa-solid fa-box-open text-[9px]"></i>${c}</span>`).join(' ')
                    : `<span class="text-[11px] text-slate-400">${r.totalItems || 1} ítems</span>`;

                return `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="py-3 px-4">
                            <div class="font-mono font-bold text-slate-900">${r.id}</div>
                            <div class="text-[10px] text-indigo-600 font-semibold">${r.sucursalExt} · ${r.tipo === 'P' ? 'Préstamo (P)' : 'Seriado (S)'}</div>
                        </td>
                        <td class="py-3 px-4 text-slate-600 font-mono text-[11px]">${r.fecha}</td>
                        <td class="py-3 px-4">
                            <div class="font-semibold text-slate-800 truncate max-w-[210px]">${r.clienteNombre}</div>
                            <div class="text-[10px] text-slate-500 truncate max-w-[210px]"><i class="fa-solid fa-user-doctor text-emerald-600 mr-1"></i>Dr. ${r.medicoNombre}</div>
                        </td>
                        <td class="py-3 px-4">${cajasHtml}</td>
                        <td class="py-3 px-4">${badgeEstado}</td>
                        <td class="py-3 px-4 text-right">
                            <a href="remitos-prestamos.html?id=${encodeURIComponent(r.id)}" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-semibold text-[11px] transition inline-flex items-center gap-1">
                                <span>Detalle</span>
                                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                            </a>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error cargando Hub Comercial:', err);
    }
});
