// public/produccion/js/cuarentena-piezas.js
// Reemplazo Web de VIAPIE / VIAORDCAL / VIAORDLIB / VIAPIERECH

const DEFAULT_CUARENTENA = [
    {
        op: "26896",
        codigo: "31-078-LQ",
        detalle: "PARTE-REEMP. TOTAL CODO POLIET- M",
        lote: "2626896",
        material: "UHMWPE / POLIETILENO",
        cantidad: 15,
        fechaIngreso: "2026-11-05",
        estadoCalidad: "Pendiente Control PZ3",
        destinoDeposito: "esteril_terminado"
    },
    {
        op: "26895",
        codigo: "11-053-49",
        detalle: "CUP.HIP LOCK NO CEMENT.HIB.64 RECU",
        lote: "2626895",
        material: "TITANIO",
        cantidad: 20,
        fechaIngreso: "2026-11-05",
        estadoCalidad: "Control Higiénico OK",
        destinoDeposito: "no_esteril_terminado"
    },
    {
        op: "26890",
        codigo: "32-080-RC",
        detalle: "FEMORAL 43 N4 DERECHA WNAV (ATL)",
        lote: "2626890",
        material: "ACERO / CR-CO",
        cantidad: 12,
        fechaIngreso: "2026-11-04",
        estadoCalidad: "Pendiente Control PZ3",
        destinoDeposito: "esteril_terminado"
    },
    {
        op: "26874",
        codigo: "71-502-03",
        detalle: "TORN POL TUL LARGA ESP 5X40MM LARGO",
        lote: "2626874",
        material: "TITANIO",
        cantidad: 50,
        fechaIngreso: "2026-11-04",
        estadoCalidad: "Control Dimensional OK",
        destinoDeposito: "no_esteril_terminado"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('cuarentena-grid');

    function getList() {
        const saved = localStorage.getItem('terian_cuarentena_viapie');
        if (!saved) {
            localStorage.setItem('terian_cuarentena_viapie', JSON.stringify(DEFAULT_CUARENTENA));
            return DEFAULT_CUARENTENA;
        }
        return JSON.parse(saved);
    }

    function saveList(list) {
        localStorage.setItem('terian_cuarentena_viapie', JSON.stringify(list));
    }

    function render() {
        const list = getList();
        grid.innerHTML = list.map((item, idx) => {
            const isLiberada = item.estadoCalidad === 'Liberada a Depósito';
            const isRechazada = item.estadoCalidad === 'Rechazada (VIAPIERECH)';
            const statusColor = isLiberada ? 'emerald' : isRechazada ? 'rose' : 'amber';

            const zebraUrl = `etiquetas-zebra.html?codigo=${encodeURIComponent(item.codigo)}&lote=${encodeURIComponent(item.lote)}&serie=${encodeURIComponent('OP' + item.op)}&desc=${encodeURIComponent(item.detalle)}&material=${encodeURIComponent(item.material)}`;

            return `
                <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-sm">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-xs font-black text-amber-500">OP #${item.op}</span>
                                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">${item.codigo}</span>
                                <span class="text-[10px] font-mono text-slate-400">Lote ${item.lote}</span>
                            </div>
                            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase">${item.detalle}</h3>
                            <p class="text-[11px] text-slate-500 mt-1">Material: <strong>${item.material}</strong> • Cantidad Lote: <strong>${item.cantidad} uds</strong></p>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-${statusColor}-500/15 text-${statusColor}-500 shrink-0">${item.estadoCalidad}</span>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <select onchange="window.cambiarDestino(${idx}, this.value)" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <option value="no_esteril_terminado" ${item.destinoDeposito === 'no_esteril_terminado' ? 'selected' : ''}>Destino: No Estéril Terminado</option>
                            <option value="esteril_terminado" ${item.destinoDeposito === 'esteril_terminado' ? 'selected' : ''}>Destino: Estéril Terminado</option>
                            <option value="semi_elaborado" ${item.destinoDeposito === 'semi_elaborado' ? 'selected' : ''}>Destino: Semielaborado</option>
                        </select>

                        <div class="flex items-center gap-1.5">
                            <button onclick="window.liberarLote(${idx})" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase border-none cursor-pointer flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">verified</span> Liberar a Depósito
                            </button>
                            <button onclick="window.rechazarLote(${idx})" class="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 font-black text-[10px] uppercase border-none cursor-pointer">
                                No Conforme
                            </button>
                            <a href="${zebraUrl}" class="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-black text-[10px] uppercase no-underline flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">print</span> Etiqueta
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.cambiarDestino = (idx, val) => {
        const list = getList();
        if (list[idx]) {
            list[idx].destinoDeposito = val;
            saveList(list);
        }
    };

    window.liberarLote = (idx) => {
        const list = getList();
        if (!list[idx]) return;
        list[idx].estadoCalidad = 'Liberada a Depósito';
        saveList(list);

        const overrides = JSON.parse(localStorage.getItem('terian_produccion_ops_status') || '{}');
        overrides[list[idx].op] = 'Liberada';
        localStorage.setItem('terian_produccion_ops_status', JSON.stringify(overrides));
        render();
    };

    window.rechazarLote = (idx) => {
        const list = getList();
        if (!list[idx]) return;
        list[idx].estadoCalidad = 'Rechazada (VIAPIERECH)';
        saveList(list);
        render();
    };

    render();
});
