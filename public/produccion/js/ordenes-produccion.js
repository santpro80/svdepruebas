// public/produccion/js/ordenes-produccion.js
// Reemplazo Web de VIAORD + SQLVIAORD.COB + monday_op_link.ps1

const MONDAY_BOARD_ID = "9012338710";

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('op-table-body');
    const searchInput = document.getElementById('op-search');
    const estadoSelect = document.getElementById('op-filter-estado');
    const countBadge = document.getElementById('op-count-badge');
    const modalNew = document.getElementById('modal-new-op');

    let cobolOps = [];
    try {
        const res = await fetch('../data-cobol/produccion_cobol.json');
        if (res.ok) cobolOps = await res.json();
    } catch (e) {
        console.warn('Error cargando produccion_cobol.json:', e);
    }

    const getCustomOps = () => JSON.parse(localStorage.getItem('terian_produccion_ops_custom') || '[]');
    const getStatusOverrides = () => JSON.parse(localStorage.getItem('terian_produccion_ops_status') || '{}');

    function getAllOps() {
        const overrides = getStatusOverrides();
        const combined = [...getCustomOps(), ...cobolOps].map(item => ({
            ...item,
            estado: overrides[item.op] || item.estado || 'En Ejecucion'
        }));
        return combined;
    }

    function renderTable() {
        const q = (searchInput.value || '').trim().toLowerCase();
        const est = estadoSelect.value;
        const all = getAllOps();

        const filtered = all.filter(item => {
            const matchQ = !q ||
                String(item.op).toLowerCase().includes(q) ||
                String(item.codigo).toLowerCase().includes(q) ||
                String(item.detalle).toLowerCase().includes(q) ||
                String(item.lote).toLowerCase().includes(q);
            const matchEst = !est || item.estado === est;
            return matchQ && matchEst;
        });

        countBadge.textContent = `${filtered.length} OPs registradas`;

        tbody.innerHTML = filtered.map(item => {
            const badgeClass = item.estado === 'Liberada'
                ? 'bg-emerald-500/15 text-emerald-500'
                : item.estado === 'Cuarentena PZ3'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-blue-500/15 text-blue-400';

            const zebraUrl = `etiquetas-zebra.html?codigo=${encodeURIComponent(item.codigoRaw || item.codigo)}&lote=${encodeURIComponent(item.lote)}&serie=${encodeURIComponent('OP' + item.op)}&desc=${encodeURIComponent(item.detalle)}&material=${encodeURIComponent(item.material)}`;

            return `
                <tr class="hover:bg-slate-200/40 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4 font-black text-emerald-500">#${item.op}</td>
                    <td class="py-3 px-4 font-semibold text-slate-500">${item.fecha}</td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${item.codigo}</td>
                    <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">${item.detalle}</td>
                    <td class="py-3 px-4">
                        <span class="block font-bold text-[11px] text-slate-700 dark:text-slate-300">${item.material}</span>
                        <span class="text-[10px] text-slate-400 font-mono">Lote: ${item.lote}</span>
                    </td>
                    <td class="py-3 px-4 text-center font-black">${item.cantidad || 20}</td>
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${badgeClass}">${item.estado}</span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <div class="inline-flex items-center gap-1.5">
                            <a href="${zebraUrl}" title="Generar Etiqueta Zebra ZPL" class="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-black text-[10px] uppercase no-underline flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">qr_code_2</span> Zebra
                            </a>
                            <button onclick="window.enviarACuarentena('${item.op}')" title="Enviar lote a Cuarentena PZ3 (VIAPIE)" class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-black text-[10px] uppercase border-none cursor-pointer flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">science</span> PZ3
                            </button>
                            <button onclick="window.abrirMondayOp('${item.op}')" title="Buscar OP en Tablero Monday #9012338710" class="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 font-black text-[10px] uppercase border-none cursor-pointer flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">open_in_new</span> Monday
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.enviarACuarentena = (opNum) => {
        const all = getAllOps();
        const found = all.find(x => String(x.op) === String(opNum));
        if (!found) return;

        const overrides = getStatusOverrides();
        overrides[opNum] = 'Cuarentena PZ3';
        localStorage.setItem('terian_produccion_ops_status', JSON.stringify(overrides));

        const cuarentenaList = JSON.parse(localStorage.getItem('terian_cuarentena_viapie') || '[]');
        if (!cuarentenaList.some(c => String(c.op) === String(opNum))) {
            cuarentenaList.unshift({
                op: found.op,
                codigo: found.codigo,
                detalle: found.detalle,
                lote: found.lote,
                material: found.material,
                cantidad: found.cantidad || 20,
                fechaIngreso: new Date().toISOString().slice(0, 10),
                estadoCalidad: 'Pendiente Control PZ3',
                destinoDeposito: 'no_esteril_terminado'
            });
            localStorage.setItem('terian_cuarentena_viapie', JSON.stringify(cuarentenaList));
        }
        renderTable();
        window.location.href = 'cuarentena-piezas.html';
    };

    window.abrirMondayOp = (opNum) => {
        const url = `https://monday.com/boards/${MONDAY_BOARD_ID}`;
        window.open(url, '_blank');
    };

    searchInput?.addEventListener('input', renderTable);
    estadoSelect?.addEventListener('change', renderTable);

    // Modal Nueva OP
    const openModalNew = () => {
        const all = getAllOps();
        const maxOp = all.reduce((max, x) => Math.max(max, parseInt(x.op, 10) || 0), 26896);
        document.getElementById('new-op-num').value = String(maxOp + 1);
        modalNew.classList.remove('hidden');
        modalNew.classList.add('flex');
    };

    document.getElementById('btn-open-new-op')?.addEventListener('click', openModalNew);
    document.getElementById('btn-close-new-op')?.addEventListener('click', () => {
        modalNew.classList.add('hidden');
        modalNew.classList.remove('flex');
    });

    document.getElementById('btn-save-new-op')?.addEventListener('click', () => {
        const op = document.getElementById('new-op-num').value.trim();
        const codigo = document.getElementById('new-op-codigo').value.trim().toUpperCase() || '42-147-31';
        const detalle = document.getElementById('new-op-detalle').value.trim().toUpperCase() || 'PIEZA OSTEOSINTESIS VILLALBA';
        const cantidad = parseInt(document.getElementById('new-op-cant').value, 10) || 20;
        const material = document.getElementById('new-op-mat').value;

        const custom = getCustomOps();
        custom.unshift({
            op,
            fecha: new Date().toISOString().slice(0, 10),
            codigo,
            codigoRaw: codigo.replace(/-/g, ''),
            rubro: codigo.slice(0, 2),
            detalle,
            cantidad,
            material,
            lote: '26' + op,
            pm: 'PM 1564-15',
            estado: 'En Ejecucion',
            origen: 'TERIAN Web'
        });
        localStorage.setItem('terian_produccion_ops_custom', JSON.stringify(custom));
        modalNew.classList.add('hidden');
        modalNew.classList.remove('flex');
        renderTable();
    });

    if (new URLSearchParams(window.location.search).get('new') === '1') {
        openModalNew();
    }

    renderTable();
});
