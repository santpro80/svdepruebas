// Centro de Control & Sincronizador Bidireccional COBOL <-> TERIAN ERP v3.0
document.addEventListener('DOMContentLoaded', async () => {
    const tbodyPuente = document.getElementById('tbody-puente');
    const badgeCambios = document.getElementById('badge-cambios-locales');

    const localOps = JSON.parse(localStorage.getItem('terian_ops_nuevas') || '[]');
    const localRemitos = JSON.parse(localStorage.getItem('terian_remitos_nuevos') || '[]');
    const localFacturas = JSON.parse(localStorage.getItem('terian_facturas_nuevas') || '[]');
    const localOcs = JSON.parse(localStorage.getItem('terian_oc_nuevas') || '[]');
    const localCli = JSON.parse(localStorage.getItem('terian_clientes_extra') || '[]');
    const localMed = JSON.parse(localStorage.getItem('terian_medicos_extra') || '[]');
    const localPrv = JSON.parse(localStorage.getItem('terian_proveedores_extra') || '[]');

    const totalNuevos = localOps.length + localRemitos.length + localFacturas.length + localOcs.length + localCli.length + localMed.length + localPrv.length;
    if (badgeCambios) {
        badgeCambios.textContent = `${totalNuevos} movimientos nuevos listos para sincronizar`;
    }

    const datasets = [
        { cobol: 'VIA47 / VIA34.04-.26', json: 'data-cobol/sucursales.json', base: 11, extra: 0, modulo: 'Comercial Multi-Sucursal', link: 'comercial/maestros-comerciales.html?tab=sucursales' },
        { cobol: 'VIA02 (Indexado Clientes)', json: 'data-cobol/clientes_cobol.json', base: 250, extra: localCli.length, modulo: 'Clientes & Obras Sociales', link: 'comercial/maestros-comerciales.html?tab=clientes' },
        { cobol: 'VIA38 (Indexado Médicos)', json: 'data-cobol/medicos_cobol.json', base: 245, extra: localMed.length, modulo: 'Médicos Cirujanos', link: 'comercial/maestros-comerciales.html?tab=medicos' },
        { cobol: 'VIA44 + VIA60 (Proveedores/OC)', json: 'data-cobol/proveedores_cobol.json', base: 200, extra: localPrv.length + localOcs.length, modulo: 'Compras & Proveedores', link: 'pedidos-internos/ordenes-compra-proveedores.html' },
        { cobol: 'VIAORD + SQLVIAORD.COB', json: 'data-cobol/produccion_cobol.json', base: 80, extra: localOps.length, modulo: 'Órdenes de Producción & Zebra', link: 'produccion/ordenes-produccion.html' },
        { cobol: 'VIA34/35 + 02-XXXX-*.TXT', json: 'data-cobol/remitos_cobol.json', base: 45, extra: localRemitos.length, modulo: 'Remitos & Préstamos Quirúrgicos', link: 'comercial/remitos-prestamos.html' },
        { cobol: 'FACWSFE + ARCHI-QR.TXT', json: 'data-cobol/facturas_cobol.json', base: 20, extra: localFacturas.length, modulo: 'Facturación AFIP WSFEv1 + QR', link: 'comercial/facturacion-afip.html' },
        { cobol: 'ANMAT_2026*.TXT + CABA-PRD', json: 'data-cobol/anmat_cobol.json', base: 60, extra: 0, modulo: 'Trazabilidad ANMAT & GCBA', link: 'comercial/facturacion-afip.html' }
    ];

    if (tbodyPuente) {
        tbodyPuente.innerHTML = datasets.map(d => `
            <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3 font-bold text-indigo-300">${d.cobol}</td>
                <td class="py-3 px-3 text-slate-300">${d.json}</td>
                <td class="py-3 px-3 font-bold text-white">${d.base}</td>
                <td class="py-3 px-3 font-bold ${d.extra > 0 ? 'text-emerald-400' : 'text-slate-500'}">+${d.extra}</td>
                <td class="py-3 px-3">
                    <a href="${d.link}" class="text-indigo-400 hover:underline font-sans font-semibold">${d.modulo} →</a>
                </td>
                <td class="py-3 px-3 text-right">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SINCRONIZADO</span>
                </td>
            </tr>
        `).join('');
    }

    // Exportar Paquete JSON Completo
    document.getElementById('btn-exportar-json')?.addEventListener('click', () => {
        const paquete = {
            sistema: 'TERIAN ERP v3.0 Unificado — Villalba Hnos. Implantes S.A.',
            fechaExportacion: new Date().toISOString(),
            cambiosWeb: {
                ordenesProduccionNuevas: localOps,
                remitosPrestamosNuevos: localRemitos,
                facturasElectronicasNuevas: localFacturas,
                ordenesCompraNuevas: localOcs,
                clientesNuevos: localCli,
                medicosNuevos: localMed,
                proveedoresNuevos: localPrv
            }
        };
        const blob = new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SINCRONIZACION_TERIAN_ERP_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Exportar Script SQL para sga_mysql
    document.getElementById('btn-exportar-sql')?.addEventListener('click', () => {
        const lines = [
            '-- ============================================================================',
            '-- SCRIPT DE SINCRONIZACION TERIAN ERP v3.0 -> MySQL (sga_mysql / Villalba)',
            `-- Generado: ${new Date().toISOString()}`,
            '-- ============================================================================',
            ''
        ];

        localOps.forEach(op => {
            lines.push(`INSERT INTO produccion_viaord (nro_orden, fecha, codigo_pieza, detalle, lote, cantidad, estado) VALUES ('${op.op}', '${op.fecha}', '${op.codigo}', '${(op.detalle || '').replace(/'/g, "''")}', '${op.lote || ''}', ${op.cantidad || 1}, '${op.estado || 'ACTIVA'}');`);
        });
        localRemitos.forEach(r => {
            lines.push(`INSERT INTO remitos_via34 (comprobante, sucursal_ext, fecha, tipo, cliente_nombre, medico_nombre, paciente, series_cajas) VALUES ('${r.id}', '${r.sucursalExt}', '${r.fecha}', '${r.tipo}', '${(r.clienteNombre || '').replace(/'/g, "''")}', '${(r.medicoNombre || '').replace(/'/g, "''")}', '${(r.paciente || '').replace(/'/g, "''")}', '${(r.cajasSerie || []).join(',')}');`);
        });
        localFacturas.forEach(f => {
            lines.push(`INSERT INTO facturas_wsfe (comprobante, fecha, cuit_receptor, razon_social, neto, iva, percepcion_arba, total, cae, vto_cae) VALUES ('${f.id}', '${f.fecha}', '${f.clienteCuit}', '${(f.clienteNombre || '').replace(/'/g, "''")}', ${f.netoGravado}, ${f.iva21}, ${f.percepcionArba}, ${f.total}, '${f.cae}', '${f.vtoCae}');`);
        });

        if (lines.length <= 5) {
            lines.push('-- (Sin altas nuevas en esta sesion local; todos los maestros base ya estan sincronizados)');
        }

        const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SYNC_SGA_MYSQL_${new Date().toISOString().slice(0, 10)}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
