// public/produccion/js/ordenes-produccion.js
// Sistema integrado de Órdenes de Producción (VIAORD + VIAORD2), Procesos (VIAPROC),
// Operaciones por Proceso (VIAOPERP), Proceso por Código de Pieza (VIAPIE) y Base de Operaciones (VIAOPER)

const MONDAY_BOARD_ID = "9012338710";
const LS_CUSTOM_OPS = 'terian_produccion_ops_custom';
const LS_STATUS_OPS = 'terian_produccion_ops_status';
const LS_RUTA_OVERRIDES = 'terian_produccion_ruta_overrides_v1';
const LS_CUSTOM_PROCESOS = 'terian_procesos_custom_v1';
const LS_CUSTOM_OPERACIONES = 'terian_operaciones_custom_v1';
const LS_PIEZAS_PROC_OVERRIDES = 'terian_piezas_proc_overrides_v1';

const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

let baseOps = [];
let allOperaciones = [];
let allProcesos = [];
let allOperarios = [];
let allPiezas = [];

let procesosMap = new Map();
let operacionesMap = new Map();
let piezasMap = new Map();

// State for New OP Modal
let newOpCurrentSteps = [];
// State for Ruta Modal
let activeRutaOp = null;
// State for Edit Proceso Modal
let editingProcSteps = [];
// Pagination for Tab 3 (5,445 códigos)
let piezasPage = 1;
const PIEZAS_PER_PAGE = 50;
let filteredPiezas = [];

function getLocalJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function setLocalJSON(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
        console.warn('Error guardando en localStorage:', e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllProductionBases();
    setupTabs();
    setupOpsEvents();
    setupNewOpModalEvents();
    setupRutaModalEvents();
    setupProcesosEvents();
    setupPiezasEvents();
    setupOperacionesEvents();
});

async function loadAllProductionBases() {
    const headerSub = document.getElementById('prod-header-sub');
    try {
        const [resOps, resProcOper, resPiezas] = await Promise.all([
            fetch('../data-cobol/produccion_cobol.json'),
            fetch('../data-cobol/procesos_operaciones_cobol.json'),
            fetch('../data-cobol/piezas_procesos_cobol.json')
        ]);

        baseOps = resOps.ok ? await resOps.json() : [];
        const procOperData = resProcOper.ok ? await resProcOper.json() : { operaciones: [], procesos: [], operarios: [] };
        const rawPiezas = resPiezas.ok ? await resPiezas.json() : [];

        // Merge custom operations
        const customOpers = getLocalJSON(LS_CUSTOM_OPERACIONES, []);
        operacionesMap.clear();
        for (const op of (procOperData.operaciones || [])) {
            operacionesMap.set(op.codigo, op);
        }
        for (const cop of customOpers) {
            operacionesMap.set(cop.codigo, cop);
        }
        allOperaciones = Array.from(operacionesMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

        // Merge custom processes
        const customProcs = getLocalJSON(LS_CUSTOM_PROCESOS, {});
        procesosMap.clear();
        for (const pr of (procOperData.procesos || [])) {
            procesosMap.set(pr.codigo, customProcs[pr.codigo] || pr);
        }
        for (const [k, v] of Object.entries(customProcs)) {
            if (!procesosMap.has(k)) procesosMap.set(k, v);
        }
        allProcesos = Array.from(procesosMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

        allOperarios = procOperData.operarios || [];

        // Merge piezas + overrides
        const piezaOverrides = getLocalJSON(LS_PIEZAS_PROC_OVERRIDES, {});
        piezasMap.clear();
        allPiezas = rawPiezas.map(pz => {
            if (piezaOverrides[pz.codigo]) {
                const newP = piezaOverrides[pz.codigo];
                pz = {
                    ...pz,
                    cod_proceso: newP,
                    nombre_proceso: procesosMap.get(newP)?.nombre || ''
                };
            }
            piezasMap.set(pz.codigo.toUpperCase(), pz);
            return pz;
        });

        updateKPIsAndSelectors();
        renderOpsTable();
        renderProcesosGrid();
        applyPiezasFilter();
        renderOperacionesGrid();

        if (headerSub) {
            headerSub.textContent = `${allProcesos.length} procesos · ${allOperaciones.length} operaciones · ${allPiezas.length.toLocaleString('es-AR')} códigos con proceso`;
        }
    } catch (err) {
        console.error('Error cargando bases de producción:', err);
        if (headerSub) headerSub.textContent = 'Error al cargar bases locales';
    }
}

function getAllOps() {
    const custom = getLocalJSON(LS_CUSTOM_OPS, []);
    const statusOverrides = getLocalJSON(LS_STATUS_OPS, {});
    const rutaOverrides = getLocalJSON(LS_RUTA_OVERRIDES, {});

    return [...custom, ...baseOps].map(item => {
        const opKey = String(item.op);
        const procCode = item.cod_proceso || piezasMap.get(String(item.codigo || '').replace(/-/g, '').toUpperCase())?.cod_proceso || '';
        const procObj = procesosMap.get(procCode);
        let opsList = rutaOverrides[opKey] || item.operaciones_op || [];
        if ((!opsList || opsList.length === 0) && procObj && procObj.operaciones?.length) {
            opsList = procObj.operaciones.map(s => ({
                sec: s.sec,
                cod_oper: s.cod_oper,
                detalle: s.detalle,
                fecha: '',
                operario: '',
                cant_conf: 0,
                cant_no_conf: 0,
                estado: 'Pendiente'
            }));
        }
        return {
            ...item,
            cod_proceso: procCode,
            nombre_proceso: item.nombre_proceso || procObj?.nombre || '',
            operaciones_op: opsList,
            estado: statusOverrides[opKey] || item.estado || 'En Ejecucion'
        };
    });
}

function updateKPIsAndSelectors() {
    const allOps = getAllOps();
    const procsWithOps = allProcesos.filter(p => (p.operaciones || []).length > 0).length;
    const totalSteps = allProcesos.reduce((acc, p) => acc + (p.operaciones?.length || 0), 0);

    document.getElementById('kpi-ops-count').textContent = allOps.length.toLocaleString('es-AR');
    document.getElementById('kpi-proc-count').textContent = allProcesos.length.toLocaleString('es-AR');
    document.getElementById('kpi-proc-sub').textContent = `${procsWithOps} con ruta (${totalSteps} pasos)`;
    document.getElementById('kpi-piezas-count').textContent = allPiezas.length.toLocaleString('es-AR');
    document.getElementById('kpi-oper-count').textContent = allOperaciones.length.toLocaleString('es-AR');
    document.getElementById('kpi-operarios-sub').textContent = `${allOperarios.length} operarios registrados`;

    // Populate Process selectors
    const procOptionsHtml = allProcesos.map(p => {
        const opsCount = (p.operaciones || []).length;
        return `<option value="${esc(p.codigo)}">[${esc(p.codigo)}] ${esc(p.nombre)} (${opsCount} oper.)</option>`;
    }).join('');

    const opFilterProc = document.getElementById('op-filter-proceso');
    if (opFilterProc) {
        opFilterProc.innerHTML = `<option value="">Todos los Procesos</option>` + procOptionsHtml;
    }

    const piezasFilterProc = document.getElementById('piezas-filter-proceso');
    if (piezasFilterProc) {
        piezasFilterProc.innerHTML = `<option value="">Filtrar por Proceso Asignado: Todos</option>` + procOptionsHtml;
    }

    const newOpProcSelect = document.getElementById('new-op-proceso');
    if (newOpProcSelect) {
        newOpProcSelect.innerHTML = `<option value="">-- Seleccionar Proceso --</option>` + procOptionsHtml;
    }

    // Populate Operations selectors
    const operOptionsHtml = allOperaciones.map(o =>
        `<option value="${esc(o.codigo)}">[${esc(o.codigo)}] ${esc(o.nombre)}</option>`
    ).join('');

    const addOperSel1 = document.getElementById('new-op-add-oper-select');
    if (addOperSel1) addOperSel1.innerHTML = operOptionsHtml;

    const addOperSel2 = document.getElementById('edit-proc-oper-select');
    if (addOperSel2) addOperSel2.innerHTML = operOptionsHtml;

    // Populate Datalist of Piezas (top 800 + dynamic matching)
    const dl = document.getElementById('datalist-piezas-codigos');
    if (dl) {
        dl.innerHTML = allPiezas.slice(0, 800).map(pz =>
            `<option value="${esc(pz.codigo)}">${esc(pz.detalle)} — Proc [${esc(pz.cod_proceso || 'S/P')}]</option>`
        ).join('');
    }
}

// =========================================================================
// TABS NAVIGATION
// =========================================================================
function switchTab(tabName) {
    ['ops', 'procesos', 'codigos', 'operaciones'].forEach(t => {
        const panel = document.getElementById(`tab-panel-${t}`);
        if (panel) panel.classList.toggle('hidden', t !== tabName);
    });
    document.querySelectorAll('.prod-tab-btn').forEach(btn => {
        const isAct = btn.getAttribute('data-tab-btn') === tabName;
        btn.className = isAct
            ? 'prod-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md shadow-emerald-600/20 cursor-pointer'
            : 'prod-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5 cursor-pointer';
    });
}

function setupTabs() {
    document.querySelectorAll('.prod-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab-btn')));
    });
    document.querySelectorAll('[data-switch-tab]').forEach(card => {
        card.addEventListener('click', () => switchTab(card.getAttribute('data-switch-tab')));
    });
}

// =========================================================================
// TAB 1: ÓRDENES DE PRODUCCIÓN TABLE
// =========================================================================
function renderOpsTable() {
    const tbody = document.getElementById('op-table-body');
    const q = (document.getElementById('op-search')?.value || '').trim().toLowerCase();
    const procFilter = document.getElementById('op-filter-proceso')?.value || '';
    const estFilter = document.getElementById('op-filter-estado')?.value || '';
    const countBadge = document.getElementById('op-count-badge');

    const all = getAllOps();
    const filtered = all.filter(item => {
        if (procFilter && item.cod_proceso !== procFilter) return false;
        if (estFilter && item.estado !== estFilter) return false;
        if (!q) return true;
        const hay = `${item.op} ${item.codigo} ${item.detalle} ${item.lote} ${item.ir} ${item.cod_proceso} ${item.nombre_proceso}`.toLowerCase();
        return hay.includes(q);
    });

    if (countBadge) countBadge.textContent = `${filtered.length} OPs registradas`;

    tbody.innerHTML = filtered.map(item => {
        const badgeClass = item.estado === 'Liberada'
            ? 'bg-emerald-500/15 text-emerald-500'
            : item.estado === 'Cuarentena PZ3'
                ? 'bg-amber-500/15 text-amber-500'
                : 'bg-blue-500/15 text-blue-400';

        const opsList = item.operaciones_op || [];
        const doneCount = opsList.filter(o => o.estado === 'Completada' || o.operario || o.fecha).length;
        const totalOps = opsList.length;

        const procHtml = item.cod_proceso
            ? `<div class="flex flex-col gap-1">
                <span class="inline-flex items-center gap-1 font-bold text-indigo-500 dark:text-indigo-400 text-[11px]">
                    <span class="px-1.5 py-0.5 rounded bg-indigo-500/15 font-mono text-[10px]">#${esc(item.cod_proceso)}</span>
                    ${esc(item.nombre_proceso || 'Proceso asignado')}
                </span>
                <button type="button" data-open-ruta="${esc(item.op)}"
                    class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-500 hover:text-emerald-400 cursor-pointer w-fit bg-slate-200/60 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700">
                    <span class="material-symbols-outlined text-[13px] text-emerald-500">checklist_rtl</span>
                    ${doneCount}/${totalOps} oper. · Ver Hoja de Ruta
                </button>
               </div>`
            : `<button type="button" data-open-ruta="${esc(item.op)}" class="text-[10px] font-bold text-amber-500 underline cursor-pointer">Sin proceso · Asignar ruta</button>`;

        const zebraUrl = `etiquetas-zebra.html?codigo=${encodeURIComponent(item.codigoRaw || item.codigo)}&lote=${encodeURIComponent(item.lote)}&serie=${encodeURIComponent('OP' + item.op)}&desc=${encodeURIComponent(item.detalle)}&material=${encodeURIComponent(item.material)}`;

        return `
            <tr class="hover:bg-slate-200/40 dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4 font-mono font-black text-emerald-500">#${esc(item.op)}</td>
                <td class="py-3 px-4 font-mono font-semibold text-slate-500">${esc(item.fecha)}</td>
                <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${esc(item.codigo)}</td>
                <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">${esc(item.detalle)}</td>
                <td class="py-3 px-4">${procHtml}</td>
                <td class="py-3 px-4">
                    <span class="block font-bold text-[11px] text-slate-700 dark:text-slate-300">${esc(item.material)}</span>
                    <span class="text-[10px] text-slate-400 font-mono">IR/Lote: ${esc(item.ir || item.lote)}</span>
                </td>
                <td class="py-3 px-4 text-center font-mono font-black">${esc(item.cantidad || 20)}</td>
                <td class="py-3 px-4">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${badgeClass}">${esc(item.estado)}</span>
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-1.5">
                        <button type="button" data-open-ruta="${esc(item.op)}" title="Hoja de Ruta de Operaciones (VIAORD2)"
                            class="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 font-black text-[10px] uppercase border-none cursor-pointer flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">route</span> Ruta (${totalOps})
                        </button>
                        <a href="${zebraUrl}" title="Generar Etiqueta Zebra ZPL"
                            class="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-black text-[10px] uppercase no-underline flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">qr_code_2</span> Zebra
                        </a>
                        <button type="button" data-send-pz3="${esc(item.op)}" title="Enviar lote a Cuarentena PZ3 (VIAPIE)"
                            class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-black text-[10px] uppercase border-none cursor-pointer flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">science</span> PZ3
                        </button>
                        <button type="button" data-open-monday="${esc(item.op)}" title="Buscar OP en Tablero Monday #9012338710"
                            class="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 font-black text-[10px] uppercase border-none cursor-pointer flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">open_in_new</span> Monday
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-open-ruta]').forEach(btn => {
        btn.addEventListener('click', () => openOpRutaModal(btn.getAttribute('data-open-ruta')));
    });
    tbody.querySelectorAll('[data-send-pz3]').forEach(btn => {
        btn.addEventListener('click', () => enviarACuarentena(btn.getAttribute('data-send-pz3')));
    });
    tbody.querySelectorAll('[data-open-monday]').forEach(btn => {
        btn.addEventListener('click', () => window.open(`https://monday.com/boards/${MONDAY_BOARD_ID}`, '_blank'));
    });
}

function enviarACuarentena(opNum) {
    const all = getAllOps();
    const found = all.find(x => String(x.op) === String(opNum));
    if (!found) return;

    const overrides = getLocalJSON(LS_STATUS_OPS, {});
    overrides[opNum] = 'Cuarentena PZ3';
    setLocalJSON(LS_STATUS_OPS, overrides);

    const cuarentenaList = getLocalJSON('terian_cuarentena_viapie', []);
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
        setLocalJSON('terian_cuarentena_viapie', cuarentenaList);
    }
    renderOpsTable();
    window.location.href = 'cuarentena-piezas.html';
}

function setupOpsEvents() {
    document.getElementById('op-search')?.addEventListener('input', renderOpsTable);
    document.getElementById('op-filter-proceso')?.addEventListener('change', renderOpsTable);
    document.getElementById('op-filter-estado')?.addEventListener('change', renderOpsTable);
}

// =========================================================================
// MODAL 1: ALTA DE ORDEN DE PRODUCCIÓN (AUTO-PROCESO Y OPERACIONES)
// =========================================================================
function openNewOpModal(prefillCode = '') {
    const all = getAllOps();
    const maxOp = all.reduce((max, x) => Math.max(max, parseInt(x.op, 10) || 0), 26906);
    document.getElementById('new-op-num').value = String(maxOp + 1);
    document.getElementById('new-op-codigo').value = '';
    document.getElementById('new-op-detalle').value = '';
    document.getElementById('new-op-cant').value = '25';
    document.getElementById('new-op-ir').value = `IR-2026-${String(maxOp + 1).slice(-3)}`;
    document.getElementById('new-op-proceso').value = '';

    newOpCurrentSteps = [];
    renderNewOpStepsTable();

    const modal = document.getElementById('modal-new-op');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (prefillCode) {
        document.getElementById('new-op-codigo').value = prefillCode;
        handleNewOpCodigoChange(prefillCode);
    }
}

function handleNewOpCodigoChange(rawCode) {
    const clean = String(rawCode || '').replace(/-/g, '').trim().toUpperCase();
    if (!clean) return;

    // 1. Buscar coincidencia exacta en las 5,445 piezas (VIAPIE)
    let pz = piezasMap.get(clean);

    // 2. Si está escribiendo, actualizar datalist dinámico con coincidencias por código o descripción
    if (!pz && clean.length >= 2) {
        const matches = allPiezas.filter(x =>
            x.codigo.toUpperCase().includes(clean) ||
            x.detalle.toUpperCase().includes(clean)
        ).slice(0, 60);
        const dl = document.getElementById('datalist-piezas-codigos');
        if (dl && matches.length > 0) {
            dl.innerHTML = matches.map(m =>
                `<option value="${esc(m.codigo)}">${esc(m.detalle)} — Proc [${esc(m.cod_proceso || 'S/P')}]</option>`
            ).join('');
        }
    }

    if (pz) {
        document.getElementById('new-op-detalle').value = pz.detalle || '';
        if (pz.material) {
            document.getElementById('new-op-mat').value = pz.material;
        }
        if (pz.cod_proceso && procesosMap.has(pz.cod_proceso)) {
            document.getElementById('new-op-proceso').value = pz.cod_proceso;
            loadProcessStepsIntoNewOp(pz.cod_proceso, `Proceso #${pz.cod_proceso} asignado automáticamente por código ${pz.codigo}`);
        }
    }
}

function loadProcessStepsIntoNewOp(procCode, customHint = '') {
    const proc = procesosMap.get(procCode);
    const hintEl = document.getElementById('new-op-proc-hint');
    if (!proc) {
        newOpCurrentSteps = [];
        if (hintEl) hintEl.textContent = 'Seleccioná un proceso para cargar sus operaciones.';
        renderNewOpStepsTable();
        return;
    }

    newOpCurrentSteps = (proc.operaciones || []).map((step, idx) => ({
        sec: String(idx + 1).padStart(2, '0'),
        cod_oper: step.cod_oper,
        detalle: step.detalle || operacionesMap.get(step.cod_oper)?.nombre || ''
    }));

    if (hintEl) {
        hintEl.textContent = customHint || `Proceso [${proc.codigo}] ${proc.nombre}: ${newOpCurrentSteps.length} operaciones cargadas en secuencia`;
    }
    renderNewOpStepsTable();
}

function renderNewOpStepsTable() {
    const tbody = document.getElementById('new-op-steps-tbody');
    const countBadge = document.getElementById('new-op-ops-count');
    if (!tbody) return;

    // Re-number sequences 01, 02, 03...
    newOpCurrentSteps.forEach((s, idx) => {
        s.sec = String(idx + 1).padStart(2, '0');
    });

    if (countBadge) countBadge.textContent = String(newOpCurrentSteps.length);

    if (newOpCurrentSteps.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-400 font-semibold">
                    Ingresá un Código de Artículo (ej: 4211805, 0604001, 10052A1) o elegí un Proceso para cargar su secuencia de operaciones.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = newOpCurrentSteps.map((s, idx) => `
        <tr class="hover:bg-slate-100/70 dark:hover:bg-slate-900/50">
            <td class="py-2 px-3 font-mono font-black text-indigo-400">${esc(s.sec)}</td>
            <td class="py-2 px-3 font-mono font-bold text-slate-600 dark:text-slate-300">#${esc(s.cod_oper)}</td>
            <td class="py-2 px-3 font-bold text-slate-900 dark:text-white">${esc(s.detalle)}</td>
            <td class="py-2 px-3 text-center">
                <div class="inline-flex items-center gap-1">
                    <button type="button" data-move-up="${idx}" ${idx === 0 ? 'disabled' : ''}
                        class="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer">
                        <span class="material-symbols-outlined text-[14px]">arrow_upward</span>
                    </button>
                    <button type="button" data-move-down="${idx}" ${idx === newOpCurrentSteps.length - 1 ? 'disabled' : ''}
                        class="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer">
                        <span class="material-symbols-outlined text-[14px]">arrow_downward</span>
                    </button>
                </div>
            </td>
            <td class="py-2 px-3 text-right">
                <button type="button" data-del-step="${idx}" class="p-1 rounded text-rose-500 hover:bg-rose-500/15 cursor-pointer">
                    <span class="material-symbols-outlined text-[15px]">delete</span>
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-move-up]').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-move-up'), 10);
            if (i > 0) {
                const tmp = newOpCurrentSteps[i - 1];
                newOpCurrentSteps[i - 1] = newOpCurrentSteps[i];
                newOpCurrentSteps[i] = tmp;
                renderNewOpStepsTable();
            }
        });
    });
    tbody.querySelectorAll('[data-move-down]').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-move-down'), 10);
            if (i < newOpCurrentSteps.length - 1) {
                const tmp = newOpCurrentSteps[i + 1];
                newOpCurrentSteps[i + 1] = newOpCurrentSteps[i];
                newOpCurrentSteps[i] = tmp;
                renderNewOpStepsTable();
            }
        });
    });
    tbody.querySelectorAll('[data-del-step]').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-del-step'), 10);
            newOpCurrentSteps.splice(i, 1);
            renderNewOpStepsTable();
        });
    });
}

function setupNewOpModalEvents() {
    const modal = document.getElementById('modal-new-op');
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    document.getElementById('btn-open-new-op')?.addEventListener('click', () => openNewOpModal());
    document.getElementById('btn-close-new-op')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-new-op')?.addEventListener('click', closeModal);

    document.getElementById('new-op-codigo')?.addEventListener('input', (e) => {
        handleNewOpCodigoChange(e.target.value);
    });

    document.getElementById('new-op-proceso')?.addEventListener('change', (e) => {
        loadProcessStepsIntoNewOp(e.target.value);
    });

    document.getElementById('btn-new-op-add-step')?.addEventListener('click', () => {
        const operCode = document.getElementById('new-op-add-oper-select')?.value;
        const operObj = operacionesMap.get(operCode);
        if (!operObj) return;
        newOpCurrentSteps.push({
            sec: String(newOpCurrentSteps.length + 1).padStart(2, '0'),
            cod_oper: operObj.codigo,
            detalle: operObj.nombre
        });
        renderNewOpStepsTable();
    });

    document.getElementById('btn-save-new-op')?.addEventListener('click', () => {
        const op = document.getElementById('new-op-num').value.trim();
        const codigo = document.getElementById('new-op-codigo').value.trim().toUpperCase();
        const detalle = document.getElementById('new-op-detalle').value.trim().toUpperCase();
        const cantidad = parseInt(document.getElementById('new-op-cant').value, 10) || 25;
        const material = document.getElementById('new-op-mat').value;
        const ir = document.getElementById('new-op-ir').value.trim().toUpperCase();
        const codProceso = document.getElementById('new-op-proceso').value;

        if (!codigo || !detalle) {
            alert('Por favor ingresá el Código de Artículo y su Descripción.');
            return;
        }
        if (!codProceso || newOpCurrentSteps.length === 0) {
            alert('Es obligatorio asignar un Proceso y al menos una Operación para generar la Orden de Producción.');
            return;
        }

        const procObj = procesosMap.get(codProceso);
        const operacionesOp = newOpCurrentSteps.map((s, idx) => ({
            sec: String(idx + 1).padStart(2, '0'),
            cod_oper: s.cod_oper,
            detalle: s.detalle,
            fecha: '',
            operario: '',
            cant_conf: 0,
            cant_no_conf: 0,
            estado: 'Pendiente'
        }));

        const custom = getLocalJSON(LS_CUSTOM_OPS, []);
        custom.unshift({
            op,
            fecha: new Date().toISOString().slice(0, 10),
            codigo,
            codigoRaw: codigo.replace(/-/g, ''),
            rubro: codigo.slice(0, 2),
            detalle,
            cantidad,
            material,
            ir,
            lote: '26' + op,
            cod_proceso: codProceso,
            nombre_proceso: procObj ? procObj.nombre : '',
            operaciones_op: operacionesOp,
            pm: 'PM 15',
            estado: 'En Ejecucion'
        });
        setLocalJSON(LS_CUSTOM_OPS, custom);

        closeModal();
        updateKPIsAndSelectors();
        renderOpsTable();
    });
}

// =========================================================================
// MODAL 2: SEGUIMIENTO DE HOJA DE RUTA / OPERACIONES DE UNA OP (VIAORD2)
// =========================================================================
function openOpRutaModal(opNum) {
    const all = getAllOps();
    const found = all.find(x => String(x.op) === String(opNum));
    if (!found) return;

    activeRutaOp = found;
    document.getElementById('ruta-modal-title').textContent =
        `Hoja de Ruta de Operaciones — OP #${found.op} (${found.codigo})`;
    document.getElementById('ruta-modal-sub').textContent =
        `${found.detalle} · Proceso [${found.cod_proceso || 'S/P'}] ${found.nombre_proceso || ''} · Cantidad OP: ${found.cantidad}`;

    const operariosOpts = `<option value="">-- Sin asignar --</option>` +
        allOperarios.map(op => `<option value="${esc(op.nombre)}">${esc(op.nombre)} (#${esc(op.codigo)})</option>`).join('');

    const tbody = document.getElementById('ruta-modal-tbody');
    const steps = found.operaciones_op || [];

    if (steps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">Esta OP no tiene operaciones asignadas.</td></tr>`;
    } else {
        tbody.innerHTML = steps.map((st, idx) => {
            const isDone = st.estado === 'Completada' || Boolean(st.operario) || Boolean(st.fecha);
            return `
                <tr class="ruta-step-row" data-step-idx="${idx}">
                    <td class="py-2.5 px-3 font-mono font-black text-indigo-400">${esc(st.sec)}</td>
                    <td class="py-2.5 px-3 font-mono font-bold">#${esc(st.cod_oper)}</td>
                    <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">${esc(st.detalle)}</td>
                    <td class="py-2.5 px-3">
                        <input type="text" list="dl-operarios-ruta" value="${esc(st.operario || '')}" placeholder="Nombre operario..."
                            class="ruta-inp-operario w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold" />
                    </td>
                    <td class="py-2.5 px-3">
                        <input type="date" value="${esc(st.fecha || '')}"
                            class="ruta-inp-fecha px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs" />
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        <input type="number" min="0" value="${st.cant_conf || (isDone ? found.cantidad : 0)}"
                            class="ruta-inp-cant w-20 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-right" />
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isDone ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}">
                            ${isDone ? 'Realizada' : 'Pendiente'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('') + `<datalist id="dl-operarios-ruta">${operariosOpts}</datalist>`;
    }

    const modal = document.getElementById('modal-op-ruta');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function setupRutaModalEvents() {
    const modal = document.getElementById('modal-op-ruta');
    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
    document.getElementById('btn-close-op-ruta')?.addEventListener('click', close);

    document.getElementById('btn-save-op-ruta')?.addEventListener('click', () => {
        if (!activeRutaOp) return;
        const rows = document.querySelectorAll('#ruta-modal-tbody .ruta-step-row');
        const updatedSteps = (activeRutaOp.operaciones_op || []).map((st, idx) => {
            const row = rows[idx];
            if (!row) return st;
            const operario = row.querySelector('.ruta-inp-operario')?.value.trim().toUpperCase() || '';
            const fecha = row.querySelector('.ruta-inp-fecha')?.value || '';
            const cantConf = parseInt(row.querySelector('.ruta-inp-cant')?.value || '0', 10);
            const done = Boolean(operario || fecha || cantConf > 0);
            return {
                ...st,
                operario,
                fecha: fecha || (operario ? new Date().toISOString().slice(0, 10) : ''),
                cant_conf: cantConf,
                estado: done ? 'Completada' : 'Pendiente'
            };
        });

        const overrides = getLocalJSON(LS_RUTA_OVERRIDES, {});
        overrides[String(activeRutaOp.op)] = updatedSteps;
        setLocalJSON(LS_RUTA_OVERRIDES, overrides);

        close();
        renderOpsTable();
    });
}

// =========================================================================
// TAB 2: PROCESOS Y QUÉ OPERACIONES LLEVA CADA PROCESO (204 PROCESOS)
// =========================================================================
function renderProcesosGrid() {
    const grid = document.getElementById('procesos-grid');
    if (!grid) return;

    const q = (document.getElementById('proc-search')?.value || '').trim().toLowerCase();
    const filterConOps = document.getElementById('proc-filter-con-ops')?.value || 'CON_OPS';

    // Count how many pieces use each process
    const piezasCountByProc = {};
    allPiezas.forEach(pz => {
        if (pz.cod_proceso) {
            piezasCountByProc[pz.cod_proceso] = (piezasCountByProc[pz.cod_proceso] || 0) + 1;
        }
    });

    const filtered = allProcesos.filter(p => {
        const ops = p.operaciones || [];
        if (filterConOps === 'CON_OPS' && ops.length === 0 && !q) return false;
        if (!q) return true;
        const opsTxt = ops.map(o => `${o.cod_oper} ${o.detalle}`).join(' ').toLowerCase();
        return p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q) || opsTxt.includes(q);
    });

    grid.innerHTML = filtered.map(p => {
        const ops = p.operaciones || [];
        const pzCount = piezasCountByProc[p.codigo] || 0;
        const stepsHtml = ops.length > 0
            ? ops.map(o => `
                <div class="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-900/70 text-[11px]">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="font-mono font-black text-indigo-500">${esc(o.sec)}.</span>
                        <span class="font-semibold text-slate-800 dark:text-slate-200 truncate">${esc(o.detalle)}</span>
                    </div>
                    <span class="font-mono text-[10px] text-slate-400 shrink-0 ml-2">Op #${esc(o.cod_oper)}</span>
                </div>
            `).join('')
            : `<p class="text-xs text-slate-400 italic py-2">Sin operaciones vinculadas aún</p>`;

        return `
            <div class="glass-card rounded-2xl p-4 flex flex-col justify-between gap-3 border border-slate-200 dark:border-slate-800">
                <div>
                    <div class="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-500 font-mono font-black text-xs">
                                    PROCESO #${esc(p.codigo)}
                                </span>
                                <span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-mono font-bold text-[10px]">
                                    ${ops.length} oper.
                                </span>
                            </div>
                            <h3 class="text-sm font-black uppercase text-slate-900 dark:text-white mt-1.5">
                                ${esc(p.nombre)}
                            </h3>
                        </div>
                        <button type="button" data-edit-proc="${esc(p.codigo)}"
                            class="px-2.5 py-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-bold cursor-pointer">
                            Editar Ruta
                        </button>
                    </div>

                    <div class="mt-3 space-y-1 max-h-52 overflow-y-auto custom-scroll pr-1">
                        ${stepsHtml}
                    </div>
                </div>

                <div class="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500 font-semibold">${pzCount.toLocaleString('es-AR')} códigos usan este proceso</span>
                    <button type="button" data-filter-piezas-proc="${esc(p.codigo)}"
                        class="text-indigo-400 hover:underline font-bold cursor-pointer">
                        Ver códigos →
                    </button>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('[data-edit-proc]').forEach(btn => {
        btn.addEventListener('click', () => openEditProcesoModal(btn.getAttribute('data-edit-proc')));
    });
    grid.querySelectorAll('[data-filter-piezas-proc]').forEach(btn => {
        btn.addEventListener('click', () => {
            const pCod = btn.getAttribute('data-filter-piezas-proc');
            document.getElementById('piezas-filter-proceso').value = pCod;
            applyPiezasFilter();
            switchTab('codigos');
        });
    });
}

function openEditProcesoModal(procCod = '') {
    const proc = procCod ? procesosMap.get(procCod) : null;
    const nextCod = String(allProcesos.length + 1).padStart(3, '0');

    document.getElementById('edit-proc-cod').value = proc ? proc.codigo : nextCod;
    document.getElementById('edit-proc-nombre').value = proc ? proc.nombre : '';
    editingProcSteps = proc ? (proc.operaciones || []).map(x => ({ ...x })) : [];

    renderEditProcSteps();
    const modal = document.getElementById('modal-edit-proceso');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function renderEditProcSteps() {
    const tbody = document.getElementById('edit-proc-steps-tbody');
    editingProcSteps.forEach((s, idx) => { s.sec = String(idx + 1).padStart(2, '0'); });

    tbody.innerHTML = editingProcSteps.map((s, idx) => `
        <tr>
            <td class="py-2 px-3 font-mono font-bold text-indigo-400">${esc(s.sec)}</td>
            <td class="py-2 px-3 font-mono">#${esc(s.cod_oper)}</td>
            <td class="py-2 px-3 font-bold">${esc(s.detalle)}</td>
            <td class="py-2 px-3 text-right">
                <button type="button" data-del-proc-step="${idx}" class="text-rose-500 hover:underline font-bold cursor-pointer">Quitar</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-del-proc-step]').forEach(btn => {
        btn.addEventListener('click', () => {
            editingProcSteps.splice(parseInt(btn.getAttribute('data-del-proc-step'), 10), 1);
            renderEditProcSteps();
        });
    });
}

function setupProcesosEvents() {
    document.getElementById('proc-search')?.addEventListener('input', renderProcesosGrid);
    document.getElementById('proc-filter-con-ops')?.addEventListener('change', renderProcesosGrid);
    document.getElementById('btn-open-new-proc')?.addEventListener('click', () => openEditProcesoModal(''));

    const modal = document.getElementById('modal-edit-proceso');
    const close = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
    document.getElementById('btn-close-edit-proc')?.addEventListener('click', close);

    document.getElementById('btn-edit-proc-add-oper')?.addEventListener('click', () => {
        const opCod = document.getElementById('edit-proc-oper-select')?.value;
        const opObj = operacionesMap.get(opCod);
        if (!opObj) return;
        editingProcSteps.push({
            sec: String(editingProcSteps.length + 1).padStart(2, '0'),
            cod_oper: opObj.codigo,
            detalle: opObj.nombre
        });
        renderEditProcSteps();
    });

    document.getElementById('btn-save-edit-proc')?.addEventListener('click', () => {
        const cod = document.getElementById('edit-proc-cod').value.trim().padStart(3, '0');
        const nombre = document.getElementById('edit-proc-nombre').value.trim().toUpperCase();
        if (!cod || !nombre) return;

        const newProc = {
            codigo: cod,
            nombre,
            descripcion: '',
            operaciones: editingProcSteps
        };
        procesosMap.set(cod, newProc);
        allProcesos = Array.from(procesosMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

        const customProcs = getLocalJSON(LS_CUSTOM_PROCESOS, {});
        customProcs[cod] = newProc;
        setLocalJSON(LS_CUSTOM_PROCESOS, customProcs);

        close();
        updateKPIsAndSelectors();
        renderProcesosGrid();
    });
}

// =========================================================================
// TAB 3: PROCESO POR CÓDIGO DE PIEZA / ARTÍCULO (5,445 CÓDIGOS)
// =========================================================================
function applyPiezasFilter() {
    const q = (document.getElementById('piezas-search')?.value || '').trim().toUpperCase();
    const procF = document.getElementById('piezas-filter-proceso')?.value || '';

    filteredPiezas = allPiezas.filter(pz => {
        if (procF && pz.cod_proceso !== procF) return false;
        if (!q) return true;
        return pz.codigo.toUpperCase().includes(q) ||
               pz.detalle.toUpperCase().includes(q) ||
               (pz.nombre_proceso || '').toUpperCase().includes(q);
    });

    piezasPage = 1;
    renderPiezasTable();
}

function renderPiezasTable() {
    const tbody = document.getElementById('piezas-table-body');
    if (!tbody) return;

    const total = filteredPiezas.length;
    const totalPages = Math.max(1, Math.ceil(total / PIEZAS_PER_PAGE));
    if (piezasPage > totalPages) piezasPage = totalPages;

    const start = (piezasPage - 1) * PIEZAS_PER_PAGE;
    const slice = filteredPiezas.slice(start, start + PIEZAS_PER_PAGE);

    document.getElementById('piezas-page-info').textContent =
        `Mostrando ${total ? start + 1 : 0}-${Math.min(start + PIEZAS_PER_PAGE, total)} de ${total.toLocaleString('es-AR')} códigos`;
    document.getElementById('piezas-page-label').textContent = `${piezasPage} / ${totalPages}`;

    tbody.innerHTML = slice.map(pz => {
        const proc = procesosMap.get(pz.cod_proceso);
        const ops = proc ? (proc.operaciones || []) : [];
        const opsSummary = ops.length > 0
            ? ops.slice(0, 4).map(o => `${o.sec}.${o.detalle}`).join(' → ') + (ops.length > 4 ? ` (+${ops.length - 4} más)` : '')
            : 'Sin secuencia definida';

        return `
            <tr class="hover:bg-slate-200/40 dark:hover:bg-slate-800/40">
                <td class="py-3 px-4 font-mono font-black text-blue-500">${esc(pz.codigo)}</td>
                <td class="py-3 px-4 font-mono text-slate-400">${esc(pz.rubro)}</td>
                <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${esc(pz.detalle)}</td>
                <td class="py-3 px-4 text-[11px] font-semibold text-slate-500">${esc(pz.material)}</td>
                <td class="py-3 px-4">
                    ${pz.cod_proceso
                        ? `<span class="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-400 font-mono font-bold text-xs">
                            [${esc(pz.cod_proceso)}] ${esc(proc?.nombre || pz.nombre_proceso || '')}
                           </span>`
                        : `<span class="text-slate-400 text-xs">Sin proceso</span>`}
                </td>
                <td class="py-3 px-4 max-w-md truncate text-[11px] text-slate-500 dark:text-slate-400" title="${esc(opsSummary)}">
                    ${esc(opsSummary)}
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button type="button" data-emitir-op-codigo="${esc(pz.codigo)}"
                        class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider cursor-pointer inline-flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">add_circle</span>
                        Crear OP con este Código
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-emitir-op-codigo]').forEach(btn => {
        btn.addEventListener('click', () => openNewOpModal(btn.getAttribute('data-emitir-op-codigo')));
    });
}

function setupPiezasEvents() {
    document.getElementById('piezas-search')?.addEventListener('input', applyPiezasFilter);
    document.getElementById('piezas-filter-proceso')?.addEventListener('change', applyPiezasFilter);
    document.getElementById('piezas-prev-btn')?.addEventListener('click', () => {
        if (piezasPage > 1) { piezasPage--; renderPiezasTable(); }
    });
    document.getElementById('piezas-next-btn')?.addEventListener('click', () => {
        piezasPage++; renderPiezasTable();
    });
}

// =========================================================================
// TAB 4: BASE DE OPERACIONES DE PLANTA (194 OPERACIONES)
// =========================================================================
function renderOperacionesGrid() {
    const grid = document.getElementById('operaciones-grid');
    if (!grid) return;

    const q = (document.getElementById('oper-search')?.value || '').trim().toLowerCase();
    const filtered = allOperaciones.filter(o =>
        !q || o.codigo.toLowerCase().includes(q) || o.nombre.toLowerCase().includes(q)
    );

    grid.innerHTML = filtered.map(o => `
        <div class="glass-card rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-3 min-w-0">
                <span class="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-500 font-mono font-black text-xs shrink-0">
                    #${esc(o.codigo)}
                </span>
                <div class="min-w-0">
                    <h4 class="text-xs font-black uppercase text-slate-900 dark:text-white truncate" title="${esc(o.nombre)}">
                        ${esc(o.nombre)}
                    </h4>
                    <span class="text-[10px] text-slate-400 font-semibold">
                        Sector: ${esc(o.sector || 'Planta')} · Calidad: ${o.ctrl_calidad === 'Y' || o.ctrl_calidad === 'S' ? 'Sí' : 'Estándar'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function setupOperacionesEvents() {
    document.getElementById('oper-search')?.addEventListener('input', renderOperacionesGrid);
    document.getElementById('btn-add-operacion-base')?.addEventListener('click', () => {
        const inp = document.getElementById('new-oper-nombre');
        const nombre = (inp?.value || '').trim();
        if (!nombre) return;

        const nextCode = String(allOperaciones.length + 1).padStart(3, '0');
        const newOp = {
            codigo: nextCode,
            nombre,
            sector: '008',
            ctrl_calidad: 'Y'
        };
        operacionesMap.set(nextCode, newOp);
        allOperaciones = Array.from(operacionesMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

        const customList = getLocalJSON(LS_CUSTOM_OPERACIONES, []);
        customList.push(newOp);
        setLocalJSON(LS_CUSTOM_OPERACIONES, customList);

        inp.value = '';
        updateKPIsAndSelectors();
        renderOperacionesGrid();
    });
}
