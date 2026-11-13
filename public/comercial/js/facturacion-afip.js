// Facturación Electrónica AFIP/ARCA (WSFEv1 + QR + Ley 27.743), Ctas. Ctes. (VIA13/23) & Trazabilidad ANMAT/GCBA
document.addEventListener('DOMContentLoaded', async () => {
    let facturas = [];
    let remitos = [];
    let anmat = [];
    let tabActual = 'facturas';

    const inputBuscar = document.getElementById('input-buscar-afip');
    const tbodyFacturas = document.getElementById('tbody-facturas');
    const tbodyCtaCte = document.getElementById('tbody-ctacte');
    const tbodyAnmat = document.getElementById('tbody-anmat');

    const panelFacturas = document.getElementById('panel-facturas');
    const panelCtaCte = document.getElementById('panel-ctacte');
    const panelAnmat = document.getElementById('panel-anmat');

    const modalNuevaFactura = document.getElementById('modal-nueva-factura');
    const modalVistaFactura = document.getElementById('modal-vista-factura');

    function fmtMoneda(val) {
        return '$' + Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    try {
        const [facRes, remRes, anmRes] = await Promise.all([
            fetch('../data-cobol/facturas_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/remitos_cobol.json').then(r => r.ok ? r.json() : []),
            fetch('../data-cobol/anmat_cobol.json').then(r => r.ok ? r.json() : [])
        ]);

        const extraFac = JSON.parse(localStorage.getItem('terian_facturas_nuevas') || '[]');
        const cobrosOverride = JSON.parse(localStorage.getItem('terian_facturas_cobros') || '{}');

        facturas = [...extraFac, ...facRes].map(f => {
            if (cobrosOverride[f.id]) {
                return { ...f, estadoCobro: 'COBRADA', saldoPendiente: 0 };
            }
            return f;
        });
        remitos = remRes;
        anmat = anmRes;

        // Poblar combo de remitos en el modal de liquidación
        const selRem = document.getElementById('fac-remito');
        if (selRem) {
            remitos.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.id} — ${r.clienteNombre.slice(0, 32)} (${(r.cajasSerie || []).join(',') || 'Implantes'})`;
                selRem.appendChild(opt);
            });
            selRem.addEventListener('change', () => {
                const found = remitos.find(r => r.id === selRem.value);
                if (found) {
                    document.getElementById('fac-cliente').value = found.clienteNombre;
                    document.getElementById('fac-cuit').value = (found.clienteCuit || '30708023910').replace(/\D/g, '');
                    document.getElementById('fac-concepto').value =
                        `LIQUIDACION QUIRURGICA SEGUN REMITO ${found.id} | PACIENTE: ${found.paciente} | DR. ${found.medicoNombre} | CAJAS: ${(found.cajasSerie || []).join(', ') || 'S/C'}`;
                }
            });
        }

        actualizarKpis();
        renderTodo();

        // Si viene ?remito=XXXX desde remitos-prestamos.html, abrir modal de liquidación pre-cargado
        const params = new URLSearchParams(window.location.search);
        if (params.get('remito')) {
            const remId = params.get('remito');
            const found = remitos.find(r => r.id === remId);
            if (found && selRem) {
                selRem.value = remId;
                selRem.dispatchEvent(new Event('change'));
            }
            modalNuevaFactura.classList.remove('hidden');
            modalNuevaFactura.classList.add('flex');
        }
    } catch (err) {
        console.error('Error cargando facturacion-afip:', err);
    }

    function actualizarKpis() {
        const totalFacturado = facturas.reduce((acc, f) => acc + Number(f.total || 0), 0);
        const totalSaldoCc = facturas.reduce((acc, f) => acc + Number(f.saldoPendiente || 0), 0);
        const totalIvaArba = facturas.reduce((acc, f) => acc + Number(f.iva21 || 0) + Number(f.percepcionArba || 0), 0);
        const pendientesCount = facturas.filter(f => Number(f.saldoPendiente || 0) > 0).length;

        document.getElementById('kpi-total-facturado').textContent = fmtMoneda(totalFacturado);
        if (facturas.length > 0) {
            document.getElementById('kpi-ultimo-cbte').textContent = facturas[0].id;
        }
        document.getElementById('kpi-saldo-cc').textContent = fmtMoneda(totalSaldoCc);
        document.getElementById('kpi-pendientes-count').textContent = pendientesCount;
        document.getElementById('kpi-iva-debito').textContent = fmtMoneda(totalIvaArba);
        document.getElementById('kpi-anmat-total').textContent = anmat.length;
    }

    function cambiarTab(nueva) {
        tabActual = nueva;
        document.querySelectorAll('.tab-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === nueva);
        });
        panelFacturas.classList.toggle('hidden', nueva !== 'facturas');
        panelCtaCte.classList.toggle('hidden', nueva !== 'ctacte');
        panelAnmat.classList.toggle('hidden', nueva !== 'anmat');
        renderTodo();
    }

    document.querySelectorAll('.tab-pill').forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.getAttribute('data-tab')));
    });

    inputBuscar?.addEventListener('input', renderTodo);

    function renderTodo() {
        const q = (inputBuscar?.value || '').trim().toUpperCase();

        // 1. Render Facturas Electrónicas
        const facFilt = facturas.filter(f => !q || `${f.id} ${f.clienteNombre} ${f.clienteCuit} ${f.cae} ${f.remitoAsociado}`.toUpperCase().includes(q));
        tbodyFacturas.innerHTML = facFilt.map(f => `
            <tr class="hover:bg-slate-50/90 transition">
                <td class="py-3.5 px-4">
                    <div class="font-mono font-bold text-slate-900">${f.id}</div>
                    <div class="text-[10px] font-semibold text-indigo-600">PV ${f.puntoVenta} · Cód. AFIP ${String(f.tipoCmpAfip).padStart(2, '0')}</div>
                </td>
                <td class="py-3.5 px-4 font-mono text-[11px] text-slate-600">${f.fecha}</td>
                <td class="py-3.5 px-4">
                    <div class="font-bold text-slate-800 truncate max-w-[230px]">${f.clienteNombre}</div>
                    <div class="font-mono text-[10px] text-slate-500">CUIT: ${f.clienteCuit}</div>
                </td>
                <td class="py-3.5 px-4">
                    <a href="remitos-prestamos.html?id=${encodeURIComponent(f.remitoAsociado || '')}" class="font-mono font-bold text-indigo-600 hover:underline">${f.remitoAsociado || 'DIRECTA'}</a>
                    <div class="text-[10px] text-slate-500 truncate max-w-[180px]">${f.paciente || ''}</div>
                </td>
                <td class="py-3.5 px-4 font-mono">
                    <div class="font-bold text-emerald-700"><i class="fa-solid fa-qrcode mr-1"></i>${f.cae}</div>
                    <div class="text-[10px] text-slate-400">Vto: ${f.vtoCae}</div>
                </td>
                <td class="py-3.5 px-4 text-right font-mono text-[11px] text-slate-600">
                    <div>Neto: ${fmtMoneda(f.netoGravado)}</div>
                    <div class="text-[10px] text-slate-400">IVA: ${fmtMoneda(f.iva21)} · ARBA: ${fmtMoneda(f.percepcionArba)}</div>
                </td>
                <td class="py-3.5 px-4 text-right font-mono font-black text-slate-900">${fmtMoneda(f.total)}</td>
                <td class="py-3.5 px-4 text-right whitespace-nowrap">
                    <button data-fac-id="${f.id}" class="btn-ver-factura px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-semibold text-[11px] transition">
                        <i class="fa-solid fa-file-pdf mr-1"></i>Factura + QR
                    </button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-ver-factura').forEach(btn => {
            btn.addEventListener('click', () => {
                const found = facturas.find(x => x.id === btn.getAttribute('data-fac-id'));
                if (found) abrirVistaFactura(found);
            });
        });

        // 2. Render Cuentas Corrientes (VIA13 / VIA23)
        tbodyCtaCte.innerHTML = facFilt.map(f => {
            const badge = f.estadoCobro === 'COBRADA'
                ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">COBRADA</span>'
                : f.estadoCobro === 'PARCIAL_CC'
                    ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">COBRO PARCIAL</span>'
                    : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">PENDIENTE CTA. CTE.</span>';

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3.5 px-4 font-mono font-bold text-slate-900">${f.id}</td>
                    <td class="py-3.5 px-4 font-mono text-slate-600">${f.fecha}</td>
                    <td class="py-3.5 px-4 font-bold text-slate-800">${f.clienteNombre}</td>
                    <td class="py-3.5 px-4 text-right font-mono text-slate-700">${fmtMoneda(f.total)}</td>
                    <td class="py-3.5 px-4 text-right font-mono font-black ${f.saldoPendiente > 0 ? 'text-amber-600' : 'text-emerald-600'}">
                        ${fmtMoneda(f.saldoPendiente)}
                    </td>
                    <td class="py-3.5 px-4 text-center">${badge}</td>
                    <td class="py-3.5 px-4 text-right">
                        ${f.saldoPendiente > 0 ? `
                            <button data-cobrar-id="${f.id}" class="btn-imputar-recibo px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition">
                                <i class="fa-solid fa-hand-holding-dollar mr-1"></i>Imputar Recibo
                            </button>
                        ` : `<span class="text-[11px] text-slate-400 font-mono">Recibo X Cancelado</span>`}
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-imputar-recibo').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-cobrar-id');
                const found = facturas.find(x => x.id === id);
                if (found) {
                    found.estadoCobro = 'COBRADA';
                    found.saldoPendiente = 0;
                    const cobrosOverride = JSON.parse(localStorage.getItem('terian_facturas_cobros') || '{}');
                    cobrosOverride[id] = true;
                    localStorage.setItem('terian_facturas_cobros', JSON.stringify(cobrosOverride));
                    actualizarKpis();
                    renderTodo();
                }
            });
        });

        // 3. Render Trazabilidad ANMAT / GCBA
        const anmFilt = anmat.filter(a => !q || `${a.serie} ${a.gtin} ${a.lote} ${a.remito} ${a.eventoDesc}`.toUpperCase().includes(q));
        tbodyAnmat.innerHTML = anmFilt.map(a => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono text-[11px] text-slate-600">${a.fechaEvento || '29/10/2026'}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px]">Cód. ${a.eventoCodigo}</span>
                    <div class="text-[11px] font-semibold text-slate-800 mt-0.5">${a.eventoDesc}</div>
                </td>
                <td class="py-3 px-4 font-mono">
                    <div class="font-bold text-slate-900">Serie: <span class="text-indigo-700">${a.serie}</span></div>
                    <div class="text-[10px] text-slate-500">GTIN: ${a.gtin}</div>
                </td>
                <td class="py-3 px-4 font-mono">
                    <div class="font-bold text-slate-800">Lote: ${a.lote}</div>
                    <div class="text-[10px] text-slate-500">Vto: ${a.vencimiento}</div>
                </td>
                <td class="py-3 px-4 font-mono text-[10px] text-slate-600">
                    <div>Orig: <strong>${a.glnOrigen}</strong></div>
                    <div>Dest: <strong>${a.glnDestino}</strong></div>
                </td>
                <td class="py-3 px-4 font-mono font-bold text-slate-800">${a.remito}</td>
                <td class="py-3 px-4 text-right">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <i class="fa-solid fa-check mr-1"></i>${a.estado}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    function abrirVistaFactura(f) {
        document.getElementById('vf-header-id').textContent = f.id;
        document.getElementById('vf-letra').textContent = f.tipo.split('-')[0];
        document.getElementById('vf-cod-afip').textContent = `Cód. ${String(f.tipoCmpAfip).padStart(2, '0')}`;
        document.getElementById('vf-numero').textContent = `${f.puntoVenta}-${f.numero}`;
        document.getElementById('vf-fecha').textContent = f.fecha;
        document.getElementById('vf-cliente').textContent = f.clienteNombre;
        document.getElementById('vf-cuit').textContent = f.clienteCuit;
        document.getElementById('vf-cond-iva').textContent = f.condicionIva || 'IVA RESPONSABLE INSCRIPTO';
        document.getElementById('vf-cond-venta').textContent = f.condicionVenta || 'CUENTA CORRIENTE 30 DIAS';
        document.getElementById('vf-remito').textContent = f.remitoAsociado || 'S/REMITO';
        document.getElementById('vf-medico-pac').textContent = `Dr. ${f.medico || 'S/D'} · Pac: ${f.paciente || 'S/D'}`;

        // Ley 27.743 + Totales
        document.getElementById('vf-ley-iva').textContent = fmtMoneda(f.iva21);
        document.getElementById('vf-ley-arba').textContent = fmtMoneda(f.percepcionArba);
        document.getElementById('vf-neto').textContent = fmtMoneda(f.netoGravado);
        document.getElementById('vf-iva').textContent = fmtMoneda(f.iva21);
        document.getElementById('vf-arba').textContent = fmtMoneda(f.percepcionArba);
        document.getElementById('vf-total').textContent = fmtMoneda(f.total);

        document.getElementById('vf-cae').textContent = f.cae;
        document.getElementById('vf-vto-cae').textContent = f.vtoCae;
        document.getElementById('vf-qr-link').href = f.qrUrl;
        document.getElementById('vf-qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(f.qrUrl)}`;

        const items = f.items && f.items.length > 0 ? f.items : [
            { codigo: '91-990-36', cantidad: 1, descripcion: 'SISTEMA DE OSTEOSINTESIS E IMPLANTES QUIRURGICOS ANMAT' }
        ];
        const unitNeto = Number(f.netoGravado || 0) / items.length;
        document.getElementById('vf-tbody-items').innerHTML = items.map(it => `
            <tr>
                <td class="py-1.5 px-2 font-bold text-slate-800">${it.codigo}</td>
                <td class="py-1.5 px-2 text-center font-bold">${it.cantidad}</td>
                <td class="py-1.5 px-2 text-slate-700">${it.descripcion}</td>
                <td class="py-1.5 px-2 text-right font-bold text-slate-900">${fmtMoneda(unitNeto)}</td>
            </tr>
        `).join('');

        modalVistaFactura.classList.remove('hidden');
        modalVistaFactura.classList.add('flex');
    }

    document.getElementById('btn-cerrar-vista-factura')?.addEventListener('click', () => {
        modalVistaFactura.classList.add('hidden');
        modalVistaFactura.classList.remove('flex');
    });

    // Cálculo en vivo en el modal de Nueva Factura
    function recalcularPreviewModal() {
        const neto = parseFloat(document.getElementById('fac-neto')?.value) || 0;
        const alic = parseFloat(document.getElementById('fac-alicuota')?.value) || 0;
        const arbaPorc = parseFloat(document.getElementById('fac-arba')?.value) || 0;

        const iva = Math.round(neto * alic * 100) / 100;
        const arba = Math.round(neto * arbaPorc * 100) / 100;
        const total = Math.round((neto + iva + arba) * 100) / 100;

        document.getElementById('preview-iva').textContent = fmtMoneda(iva);
        document.getElementById('preview-arba').textContent = fmtMoneda(arba);
        document.getElementById('preview-total').textContent = fmtMoneda(total);
    }

    ['fac-neto', 'fac-alicuota', 'fac-arba'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', recalcularPreviewModal);
        document.getElementById(id)?.addEventListener('change', recalcularPreviewModal);
    });

    // Abrir/Cerrar modal Nueva Factura
    document.getElementById('btn-emitir-factura')?.addEventListener('click', () => {
        recalcularPreviewModal();
        modalNuevaFactura.classList.remove('hidden');
        modalNuevaFactura.classList.add('flex');
    });
    const cerrarNuevaFactura = () => {
        modalNuevaFactura.classList.add('hidden');
        modalNuevaFactura.classList.remove('flex');
    };
    document.getElementById('btn-cerrar-modal-factura')?.addEventListener('click', cerrarNuevaFactura);
    document.getElementById('btn-cancelar-factura')?.addEventListener('click', cerrarNuevaFactura);

    // Autorizar Nueva Factura Electrónica (WSFEv1 + QR Base64)
    document.getElementById('form-nueva-factura')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const [tipoLetra, codAfipStr] = document.getElementById('fac-tipo').value.split('|');
        const tipoCmpAfip = parseInt(codAfipStr, 10);
        const pv = document.getElementById('fac-pv').value;
        const remitoAsociado = document.getElementById('fac-remito').value || 'DIRECTA';
        const clienteNombre = document.getElementById('fac-cliente').value.trim().toUpperCase();
        const clienteCuit = document.getElementById('fac-cuit').value.replace(/\D/g, '') || '30708023910';
        const neto = parseFloat(document.getElementById('fac-neto').value) || 0;
        const alic = parseFloat(document.getElementById('fac-alicuota').value) || 0;
        const arbaPorc = parseFloat(document.getElementById('fac-arba').value) || 0;
        const concepto = document.getElementById('fac-concepto').value.trim().toUpperCase();

        const iva21 = Math.round(neto * alic * 100) / 100;
        const percepcionArba = Math.round(neto * arbaPorc * 100) / 100;
        const total = Math.round((neto + iva21 + percepcionArba) * 100) / 100;

        let maxNro = 11827;
        facturas.forEach(f => {
            const n = parseInt(f.numero, 10);
            if (!isNaN(n) && n > maxNro) maxNro = n;
        });
        const nuevoNro = maxNro + 1;
        const numeroPad = String(nuevoNro).padStart(8, '0');
        const fechaHoy = new Date().toISOString().slice(0, 10);
        const vtoDate = new Date();
        vtoDate.setDate(vtoDate.getDate() + 10);
        const vtoCae = vtoDate.toISOString().slice(0, 10);
        const cae = String(86451211698114 + facturas.length * 91);

        // Generar JSON QR Oficial AFIP (RG 4892/2020 como en ARCHI-QR.TXT)
        const qrJson = JSON.stringify({
            ver: 1,
            fecha: fechaHoy,
            cuit: 30708758732,
            ptoVta: parseInt(pv, 10),
            tipoCmp: tipoCmpAfip,
            nroCmp: nuevoNro,
            importe: total,
            moneda: 'PES',
            ctz: 1.0,
            tipoDocRec: 80,
            nroDocRec: parseInt(clienteCuit, 10) || 30708023910,
            tipoCodAut: 'E',
            codAut: parseInt(cae, 10)
        });
        const qrBase64 = btoa(qrJson);
        const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;

        const nuevaFac = {
            id: `${tipoLetra}-${pv}-${numeroPad}`,
            tipo: tipoLetra,
            tipoCmpAfip,
            puntoVenta: pv,
            numero: numeroPad,
            fecha: fechaHoy,
            clienteCodigo: 'WEB',
            clienteNombre,
            clienteCuit,
            condicionIva: 'IVA RESPONSABLE INSCRIPTO',
            condicionVenta: 'CUENTA CORRIENTE 30 DIAS',
            remitoAsociado,
            medico: 'CIRUGIA ESPECIALIZADA',
            paciente: 'AFILIADO SEGUN ORDEN',
            cajasSerie: [],
            netoGravado: neto,
            iva21,
            percepcionArba,
            total,
            cae,
            vtoCae,
            estadoCobro: 'PENDIENTE_CC',
            saldoPendiente: total,
            qrUrl,
            items: [
                { codigo: '91-990-00', cantidad: 1, descripcion: concepto }
            ]
        };

        const guardadas = JSON.parse(localStorage.getItem('terian_facturas_nuevas') || '[]');
        guardadas.unshift(nuevaFac);
        localStorage.setItem('terian_facturas_nuevas', JSON.stringify(guardadas));

        facturas.unshift(nuevaFac);
        cerrarNuevaFactura();
        actualizarKpis();
        renderTodo();
        abrirVistaFactura(nuevaFac);
    });

    // Exportar Libro IVA Ventas Digital (.CSV)
    document.getElementById('btn-exportar-iva')?.addEventListener('click', () => {
        const header = 'FECHA;COMPROBANTE;COD_AFIP;PUNTO_VENTA;NUMERO;CLIENTE;CUIT;NETO_GRAVADO;IVA_21;PERC_IIBB_ARBA;TOTAL;CAE;VTO_CAE';
        const rows = facturas.map(f => [
            f.fecha,
            f.id,
            f.tipoCmpAfip,
            f.puntoVenta,
            f.numero,
            `"${(f.clienteNombre || '').replace(/"/g, '""')}"`,
            f.clienteCuit,
            f.netoGravado,
            f.iva21,
            f.percepcionArba,
            f.total,
            f.cae,
            f.vtoCae
        ].join(';'));

        const blob = new Blob(['\uFEFF' + [header, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LIBRO_IVA_VENTAS_AFIP_${new Date().toISOString().slice(0, 10)}.CSV`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Exportar TXT Oficial ANMAT
    document.getElementById('btn-exportar-anmat')?.addEventListener('click', () => {
        const lines = anmat.map(a =>
            `${(a.eventoDesc || 'VENTA AL MEDICO').padEnd(50, ' ')}|GLN_ORIG:${a.glnOrigen}|GLN_DEST:${a.glnDestino}|GTIN:${a.gtin}|EV:${a.eventoCodigo}|SERIE:${a.serie}|REMITO:${a.remito}|LOTE:${a.lote}|VTO:${a.vencimiento}|FECHA:${a.fechaEvento}`
        );
        const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ANMAT_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.TXT`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
