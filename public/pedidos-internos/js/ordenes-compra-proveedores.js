import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, doc, updateDoc, setDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const LS_CUSTOM_PROV = 'villalba_proveedores_custom_v1';
const LS_CUSTOM_OCS = 'villalba_ordenes_compra_custom_v1';
const LS_STATUS_OVERRIDES = 'villalba_oc_status_overrides_v1';

let allProveedores = [];
let allOrdenes = [];
let filteredProveedores = [];
let filteredOrdenes = [];

let currentMainTab = 'proveedores'; // 'proveedores' | 'ordenes'
let provPage = 1;
const PROV_PER_PAGE = 24;

let ocPage = 1;
const OC_PER_PAGE = 40;

let activeLegajoProv = null;
let activeLegajoTab = 'ocs';
let activeDetalleOc = null;

// Helpers
const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtMoney = (val, mon = 'ARS') => {
    const num = Number(val || 0);
    const sym = (String(mon).toUpperCase().includes('USD') || String(mon).toUpperCase().includes('U$S')) ? 'U$S ' : '$ ';
    return sym + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtInt = (val) => Number(val || 0).toLocaleString('es-AR');

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

function isOcPending(est) {
    const s = String(est || '').toUpperCase();
    return s.includes('ABIERTA') || s.includes('PENDIENTE') || s.includes('ENVIADA') || s.includes('APROBADA') || s.includes('PARCIAL');
}

function getEstadoBadge(est) {
    const s = String(est || 'CERRADA').toUpperCase();
    if (isOcPending(s)) {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>${esc(s.replace('_', ' '))}
        </span>`;
    }
    if (s.includes('ANULA') || s.includes('BAJA')) {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">${esc(s)}</span>`;
    }
    if (s.includes('PDF') || s.includes('DIGITAL')) {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">PDF OT</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">${esc(s)}</span>`;
}

// =========================================================================
// 1. CARGA DE DATOS (JSON REAL DE 370 PROVEEDORES + 7.448 OCs + FIRESTORE)
// =========================================================================
async function loadAllData() {
    const statusLabel = document.getElementById('sync-status-label');
    try {
        const [provRes, ocRes] = await Promise.all([
            fetch('../data-cobol/proveedores_cobol.json'),
            fetch('../data-cobol/ordenes_compra_cobol.json')
        ]);

        const baseProvs = provRes.ok ? await provRes.json() : [];
        const baseOcs = ocRes.ok ? await ocRes.json() : [];

        // Merge custom suppliers & edits from localStorage
        const customProvs = getLocalJSON(LS_CUSTOM_PROV, {});
        const provMap = new Map();
        for (const p of baseProvs) {
            const key = p.carpeta || p.codigo_proveedor;
            provMap.set(key, customProvs[key] ? { ...p, ...customProvs[key] } : p);
        }
        for (const [key, cp] of Object.entries(customProvs)) {
            if (!provMap.has(key)) provMap.set(key, cp);
        }
        allProveedores = Array.from(provMap.values());

        // Merge custom OCs and status overrides
        const customOcs = getLocalJSON(LS_CUSTOM_OCS, []);
        const statusOverrides = getLocalJSON(LS_STATUS_OVERRIDES, {});

        // Try syncing custom OCs from Firestore non-blocking
        try {
            const snap = await getDocs(query(collection(db, "ordenes_compra_proveedores"), orderBy("createdAt", "desc")));
            const fsOcs = [];
            snap.forEach(d => {
                const data = d.data();
                if (data && data.nro_oc) {
                    fsOcs.push({ id: d.id, ...data });
                }
            });
            if (fsOcs.length > 0) {
                const existingIds = new Set(customOcs.map(o => o.nro_oc));
                for (const fo of fsOcs) {
                    if (!existingIds.has(fo.nro_oc)) customOcs.unshift(fo);
                }
                setLocalJSON(LS_CUSTOM_OCS, customOcs);
            }
        } catch (err) {
            console.warn("Modo local activo (sin lectura remota adicional):", err?.message);
        }

        allOrdenes = [...customOcs, ...baseOcs].map(oc => {
            if (statusOverrides[oc.id]) {
                return { ...oc, estado: statusOverrides[oc.id] };
            }
            return oc;
        });

        // Add any newly created web OCs to their supplier summary counters
        const provByCode = new Map();
        const provByName = new Map();
        allProveedores.forEach(p => {
            if (p.codigo_proveedor) provByCode.set(String(p.codigo_proveedor).trim(), p);
            if (p.razon_social) provByName.set(String(p.razon_social).trim().toUpperCase(), p);
        });

        for (const co of customOcs) {
            const match = provByCode.get(String(co.cod_prov || '').trim()) ||
                          provByName.get(String(co.proveedor || '').trim().toUpperCase());
            if (match && !co._countedInProv) {
                match.resumen = match.resumen || {};
                match.resumen.total_oc_cobol = (match.resumen.total_oc_cobol || 0) + 1;
                match.resumen.total_oc = (match.resumen.total_oc || 0) + 1;
                if (co.moneda === 'USD') {
                    match.resumen.importe_usd = (match.resumen.importe_usd || 0) + Number(co.total || 0);
                } else {
                    match.resumen.importe_ars = (match.resumen.importe_ars || 0) + Number(co.total || 0);
                }
                if (!match.resumen.ultima_oc || co.fecha > match.resumen.ultima_oc) {
                    match.resumen.ultima_oc = co.fecha;
                }
                co.carpeta_prov = match.carpeta;
                co._countedInProv = true;
            }
        }

        populateSupplierDatalist();
        updateKPIs();
        applyProveedoresFilter();
        applyOrdenesFilter();

        if (statusLabel) {
            statusLabel.textContent = `${fmtInt(allProveedores.length)} carpetas de proveedores · ${fmtInt(allOrdenes.length)} órdenes de compra operativas`;
        }

        // Check URL params
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'ordenes') {
            switchMainTab('ordenes');
        }
        if (params.get('prov')) {
            const qProv = params.get('prov').toUpperCase();
            const found = allProveedores.find(p =>
                String(p.codigo_proveedor).toUpperCase() === qProv ||
                String(p.carpeta).toUpperCase().includes(qProv)
            );
            if (found) openLegajoProveedor(found.carpeta);
        }
    } catch (error) {
        console.error('Error cargando datos de proveedores y OCs:', error);
        if (statusLabel) statusLabel.textContent = 'Error al cargar datos locales';
    }
}

function updateKPIs() {
    const totalProv = allProveedores.length;
    const homologados = allProveedores.filter(p => p.homologado_sgc).length;
    const conOc = allProveedores.filter(p => (p.resumen?.total_oc || 0) > 0).length;

    const totalOc = allOrdenes.length;
    const pendOc = allOrdenes.filter(o => isOcPending(o.estado)).length;

    let totalRec = 0;
    let totalDocs = 0;
    for (const p of allProveedores) {
        totalRec += (p.resumen?.total_recepciones || 0) + (p.resumen?.total_remitos_mp || 0);
        totalDocs += (p.resumen?.total_documentos || 0);
    }

    document.getElementById('kpi-total-prov').textContent = fmtInt(totalProv);
    document.getElementById('kpi-sub-prov').textContent = `${fmtInt(conOc)} con OCs · ${fmtInt(homologados)} Homologados SGC`;

    document.getElementById('kpi-total-oc').textContent = fmtInt(totalOc);
    document.getElementById('kpi-sub-oc').textContent = `Histórico completo + Web`;

    document.getElementById('kpi-total-pend').textContent = fmtInt(pendOc);
    document.getElementById('kpi-sub-pend').textContent = `Pendientes de entrega / recepción`;

    document.getElementById('kpi-total-rec').textContent = fmtInt(totalRec);
    document.getElementById('kpi-sub-rec').textContent = `${fmtInt(totalDocs)} PDFs y docs en carpetas`;

    document.getElementById('badge-count-prov').textContent = fmtInt(totalProv);
    document.getElementById('badge-count-oc').textContent = fmtInt(totalOc);
}

function populateSupplierDatalist() {
    const dl = document.getElementById('datalist-proveedores');
    if (!dl) return;
    dl.innerHTML = allProveedores.map(p => {
        const cod = p.codigo_proveedor ? `[${p.codigo_proveedor}]` : '';
        return `<option value="${esc(p.razon_social)} ${esc(cod)}" data-cuit="${esc(p.cuit)}"></option>`;
    }).join('');
}

// =========================================================================
// 2. PESTAÑA 1: CARPETAS DE PROVEEDORES (BUSCADOR, FILTROS Y GRILLA)
// =========================================================================
function applyProveedoresFilter() {
    const q = (document.getElementById('search-proveedores')?.value || '').trim().toUpperCase();
    const tipo = document.getElementById('filter-prov-tipo')?.value || 'TODOS';
    const sort = document.getElementById('sort-proveedores')?.value || 'OCS_DESC';

    filteredProveedores = allProveedores.filter(p => {
        const res = p.resumen || {};
        if (tipo === 'CON_OC' && (res.total_oc || 0) === 0) return false;
        if (tipo === 'HOMOLOGADOS' && !p.homologado_sgc) return false;
        if (tipo === 'CON_RECEPCIONES' && (res.total_recepciones || 0) === 0) return false;
        if (tipo === 'CON_REMITOS_MP' && (res.total_remitos_mp || 0) === 0) return false;
        if (tipo === 'CON_DOCS' && (res.total_documentos || 0) === 0) return false;

        if (!q) return true;
        constotStr = (p.codigos_ot || []).join(' ');
        const haystack = `${p.razon_social} ${p.codigo_proveedor} ${constotStr} ${p.cuit} ${p.localidad} ${p.provincia} ${p.rubro_sgc} ${p.categoria_sgc} ${p.carpeta}`.toUpperCase();
        return haystack.includes(q);
    });

    filteredProveedores.sort((a, b) => {
        const ra = a.resumen || {};
        const rb = b.resumen || {};
        if (sort === 'OCS_DESC') return (rb.total_oc || 0) - (ra.total_oc || 0) || a.razon_social.localeCompare(b.razon_social);
        if (sort === 'ULTIMA_OC') return String(rb.ultima_oc || '').localeCompare(String(ra.ultima_oc || ''));
        if (sort === 'NOMBRE_ASC') return String(a.razon_social || '').localeCompare(String(b.razon_social || ''));
        if (sort === 'IMPORTE_DESC') return (rb.importe_ars || 0) - (ra.importe_ars || 0);
        if (sort === 'CODIGO_ASC') return String(a.codigo_proveedor || '').localeCompare(String(b.codigo_proveedor || ''));
        return 0;
    });

    provPage = 1;
    renderProveedoresGrid();
}

function renderProveedoresGrid() {
    const grid = document.getElementById('proveedores-grid');
    if (!grid) return;

    const total = filteredProveedores.length;
    const totalPages = Math.max(1, Math.ceil(total / PROV_PER_PAGE));
    if (provPage > totalPages) provPage = totalPages;

    const start = (provPage - 1) * PROV_PER_PAGE;
    const slice = filteredProveedores.slice(start, start + PROV_PER_PAGE);

    document.getElementById('prov-pagination-info').textContent =
        `Mostrando ${total ? start + 1 : 0}-${Math.min(start + PROV_PER_PAGE, total)} de ${fmtInt(total)} carpetas de proveedores`;
    document.getElementById('prov-page-label').textContent = `${provPage} / ${totalPages}`;
    document.getElementById('prov-prev-btn').disabled = provPage <= 1;
    document.getElementById('prov-next-btn').disabled = provPage >= totalPages;

    if (slice.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full glass-card rounded-2xl p-10 text-center space-y-2">
                <span class="material-symbols-outlined text-4xl text-slate-400">folder_off</span>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">No se encontraron proveedores con ese filtro</p>
            </div>`;
        return;
    }

    grid.innerHTML = slice.map(p => {
        const res = p.resumen || {};
        const otTags = (p.codigos_ot || []).length
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25">OT #${esc(p.codigos_ot.join('/'))}</span>`
            : '';
        const sgcTag = p.homologado_sgc
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">SGC ${esc(p.categoria_sgc || 'HOMOLOGADO')}</span>`
            : '';

        return `
        <div class="glass-card rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-villalba-blue/50 transition-all group">
            <div>
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-villalba-blue/15 border border-villalba-blue/25 flex items-center justify-center text-villalba-blue shrink-0 group-hover:scale-105 transition-transform">
                            <span class="material-symbols-outlined text-xl">folder_shared</span>
                        </div>
                        <div class="min-w-0">
                            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase truncate" title="${esc(p.razon_social)}">
                                ${esc(p.razon_social)}
                            </h3>
                            <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                    #${esc(p.codigo_proveedor)}
                                </span>
                                ${otTags}
                                ${sgcTag}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <div class="flex items-center justify-between">
                        <span class="font-mono text-[11px]">CUIT: <strong class="text-slate-800 dark:text-slate-200">${esc(p.cuit || 'S/D')}</strong></span>
                        <span class="text-[11px] truncate max-w-[170px]" title="${esc(p.localidad)} ${esc(p.provincia)}">${esc(p.localidad || p.provincia || 'Sin localidad')}</span>
                    </div>
                    ${p.rubro_sgc ? `<p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">Rubro: ${esc(p.rubro_sgc)}</p>` : ''}
                    ${p.telefonos ? `<p class="text-[11px] truncate">Tel: ${esc(p.telefonos)}</p>` : ''}
                </div>

                <!-- Counters inside Supplier Folder -->
                <div class="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-200/70 dark:border-white/10 text-center">
                    <div class="p-1.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.03]">
                        <span class="block text-xs font-black font-mono text-villalba-blue">${fmtInt(res.total_oc_cobol || 0)}</span>
                        <span class="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">OCs Sist.</span>
                    </div>
                    <div class="p-1.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.03]">
                        <span class="block text-xs font-black font-mono text-indigo-500 dark:text-indigo-400">${fmtInt(res.total_oc_ot || 0)}</span>
                        <span class="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">PDFs OT</span>
                    </div>
                    <div class="p-1.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.03]">
                        <span class="block text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">${fmtInt((res.total_recepciones || 0) + (res.total_remitos_mp || 0))}</span>
                        <span class="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Recep/MP</span>
                    </div>
                    <div class="p-1.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.03]">
                        <span class="block text-xs font-black font-mono text-amber-600 dark:text-amber-400">${fmtInt(res.total_documentos || 0)}</span>
                        <span class="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Archivos</span>
                    </div>
                </div>
            </div>

            <div class="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-white/5">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    ${res.ultima_oc ? `Últ. OC: <strong class="font-mono text-slate-700 dark:text-slate-200">${esc(res.ultima_oc)}</strong>` : 'Sin OCs registradas'}
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" data-open-legajo="${esc(p.carpeta)}"
                        class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-villalba-blue/15 hover:bg-villalba-blue text-villalba-blue hover:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer">
                        <span class="material-symbols-outlined text-sm">folder_open</span>
                        Abrir Carpeta
                    </button>
                    <button type="button" data-new-oc-prov="${esc(p.carpeta)}" title="Emitir OC a este proveedor"
                        class="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-500/20 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-emerald-400 transition-all cursor-pointer">
                        <span class="material-symbols-outlined text-base">add_shopping_cart</span>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');

    // Wire buttons
    grid.querySelectorAll('[data-open-legajo]').forEach(btn => {
        btn.addEventListener('click', () => openLegajoProveedor(btn.getAttribute('data-open-legajo')));
    });
    grid.querySelectorAll('[data-new-oc-prov]').forEach(btn => {
        btn.addEventListener('click', () => openNuevaOcModal(btn.getAttribute('data-new-oc-prov')));
    });
}

// =========================================================================
// 3. PESTAÑA 2: TABLA DE ÓRDENES DE COMPRA (7.448+ OCs)
// =========================================================================
function applyOrdenesFilter() {
    const q = (document.getElementById('search-ordenes')?.value || '').trim().toUpperCase();
    const est = document.getElementById('filter-oc-estado')?.value || 'TODOS';
    const orig = document.getElementById('filter-oc-origen')?.value || 'TODOS';
    const mon = document.getElementById('filter-oc-moneda')?.value || 'TODAS';

    filteredOrdenes = allOrdenes.filter(o => {
        if (est === 'ABIERTAS' && !isOcPending(o.estado)) return false;
        if (est === 'WEB' && o.sistema !== 'WEB') return false;
        if (est === 'CERRADA' && (isOcPending(o.estado) || String(o.estado).includes('PDF') || String(o.estado).includes('ANULA'))) return false;
        if (est === 'DIGITALIZADA_PDF' && o.sistema !== 'OT_PDF') return false;
        if (est === 'ANULADA' && !String(o.estado).toUpperCase().includes('ANULA') && !String(o.estado).toUpperCase().includes('BAJA')) return false;

        if (orig !== 'TODOS') {
            if (orig === 'WEB' && o.sistema !== 'WEB') return false;
            else if (orig !== 'WEB' && !String(o.origen || '').toUpperCase().includes(orig)) return false;
        }

        if (mon !== 'TODAS') {
            const isUsd = String(o.moneda || '').toUpperCase().includes('USD') || String(o.moneda || '').toUpperCase().includes('U$S');
            if (mon === 'USD' && !isUsd) return false;
            if (mon === 'ARS' && isUsd) return false;
        }

        if (!q) return true;
        const itemsTxt = (o.items || []).map(it => `${it.cod} ${it.rubro} ${it.desc}`).join(' ');
        const hay = `${o.nro_oc} ${o.nro_corto} ${o.proveedor} ${o.cod_prov} ${o.cuit} ${o.requerido_por} ${o.autoriza} ${o.obs} ${itemsTxt}`.toUpperCase();
        return hay.includes(q);
    });

    ocPage = 1;
    renderOrdenesTable();
}

function renderOrdenesTable() {
    const tbody = document.getElementById('oc-table-body');
    if (!tbody) return;

    const total = filteredOrdenes.length;
    const totalPages = Math.max(1, Math.ceil(total / OC_PER_PAGE));
    if (ocPage > totalPages) ocPage = totalPages;

    const start = (ocPage - 1) * OC_PER_PAGE;
    const slice = filteredOrdenes.slice(start, start + OC_PER_PAGE);

    document.getElementById('oc-pagination-info').textContent =
        `Mostrando ${total ? start + 1 : 0}-${Math.min(start + OC_PER_PAGE, total)} de ${fmtInt(total)} órdenes de compra`;
    document.getElementById('oc-page-label').textContent = `${ocPage} / ${totalPages}`;
    document.getElementById('oc-prev-btn').disabled = ocPage <= 1;
    document.getElementById('oc-next-btn').disabled = ocPage >= totalPages;

    if (slice.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="py-10 text-center text-slate-500 dark:text-slate-400 font-bold">
                    No se encontraron órdenes de compra con los filtros actuales.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = slice.map(o => {
        const firstItem = (o.items && o.items[0]) ? o.items[0] : null;
        const descMain = firstItem ? (firstItem.desc || firstItem.rubro || o.obs || 'Sin detalle') : (o.obs || 'Sin detalle');
        const extraItems = (o.cant_items || (o.items ? o.items.length : 0)) > 1
            ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-villalba-blue/15 text-villalba-blue font-mono text-[10px] font-bold">+${(o.cant_items || o.items.length) - 1} ítems</span>`
            : '';

        return `
        <tr class="hover:bg-slate-100/70 dark:hover:bg-white/[0.03] transition-colors">
            <td class="py-3 px-4 whitespace-nowrap">
                <span class="font-mono font-black text-xs text-villalba-blue block">${esc(o.nro_oc)}</span>
                <span class="text-[10px] font-mono text-slate-400 uppercase">${esc(o.origen)}</span>
            </td>
            <td class="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700 dark:text-slate-300">
                ${esc(o.fecha || 'S/F')}
            </td>
            <td class="py-3 px-4">
                <button type="button" data-oc-open-prov="${esc(o.carpeta_prov || '')}"
                    class="text-left group cursor-pointer">
                    <span class="font-bold text-xs text-slate-900 dark:text-white group-hover:text-villalba-blue uppercase block max-w-[230px] truncate" title="${esc(o.proveedor)}">
                        ${esc(o.proveedor)}
                    </span>
                    <span class="text-[10px] font-mono text-slate-400">#${esc(o.cod_prov)} ${o.cuit ? `· ${esc(o.cuit)}` : ''}</span>
                </button>
            </td>
            <td class="py-3 px-4 max-w-[320px]">
                <div class="text-xs text-slate-800 dark:text-slate-200 truncate" title="${esc(descMain)}">
                    ${esc(descMain)}
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5 flex items-center">
                    ${firstItem && firstItem.cant ? `<span class="font-mono">Cant: ${esc(firstItem.cant)}</span>` : ''}
                    ${extraItems}
                </div>
            </td>
            <td class="py-3 px-4 whitespace-nowrap text-xs">
                <span class="font-semibold text-slate-700 dark:text-slate-300 block">${esc(o.requerido_por || '-')}</span>
                <span class="text-[10px] text-slate-400">${esc(o.autoriza || '')}</span>
            </td>
            <td class="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                ${o.total > 0 ? fmtMoney(o.total, o.moneda) : '<span class="text-slate-400 font-normal">S/Valor</span>'}
            </td>
            <td class="py-3 px-4 whitespace-nowrap text-center">
                ${getEstadoBadge(o.estado)}
            </td>
            <td class="py-3 px-4 whitespace-nowrap text-right">
                <div class="inline-flex items-center gap-1">
                    <button type="button" data-view-oc="${esc(o.id)}" title="Ver / Imprimir Comprobante OC"
                        class="px-2.5 py-1.5 rounded-xl bg-villalba-blue/15 hover:bg-villalba-blue text-villalba-blue hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">visibility</span>
                        Ver OC
                    </button>
                    ${o.carpeta_prov ? `
                    <button type="button" data-oc-open-prov="${esc(o.carpeta_prov)}" title="Abrir Carpeta del Proveedor"
                        class="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer">
                        <span class="material-symbols-outlined text-sm">folder_shared</span>
                    </button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-view-oc]').forEach(btn => {
        btn.addEventListener('click', () => openDetalleOcModal(btn.getAttribute('data-view-oc')));
    });
    tbody.querySelectorAll('[data-oc-open-prov]').forEach(btn => {
        btn.addEventListener('click', () => {
            const carp = btn.getAttribute('data-oc-open-prov');
            if (carp) openLegajoProveedor(carp);
        });
    });
}

// =========================================================================
// 4. MODAL 1: CARPETA / LEGAJO COMPLETO DEL PROVEEDOR
// =========================================================================
function openLegajoProveedor(carpetaName) {
    const prov = allProveedores.find(p => p.carpeta === carpetaName || p.codigo_proveedor === carpetaName);
    if (!prov) return;

    activeLegajoProv = prov;
    activeLegajoTab = 'ocs';

    document.getElementById('legajo-razon-social').textContent = prov.razon_social;
    document.getElementById('legajo-cod-badge').textContent = `#${prov.codigo_proveedor || 'S/C'}`;

    const sgcBadge = document.getElementById('legajo-sgc-badge');
    if (prov.homologado_sgc) {
        sgcBadge.textContent = `HOMOLOGADO SGC · ${prov.categoria_sgc || 'CALIDAD'}`;
        sgcBadge.classList.remove('hidden');
    } else {
        sgcBadge.classList.add('hidden');
    }

    const otInfo = (prov.codigos_ot || []).length ? ` | Código OT: #${prov.codigos_ot.join(', #')}` : '';
    document.getElementById('legajo-sub-info').textContent =
        `CUIT: ${prov.cuit || 'No registrado'}${otInfo} | Localidad: ${prov.localidad || '-'} (${prov.provincia || '-'})`;
    document.getElementById('legajo-carpeta-path').textContent =
        `Carpeta Desktop: C:\\Users\\Tecnica\\Desktop\\proveedores\\${prov.carpeta}`;

    const res = prov.resumen || {};
    document.getElementById('legajo-ficha-grid').innerHTML = `
        <div class="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Dirección</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 truncate block" title="${esc(prov.domicilio)}">${esc(prov.domicilio || 'No especificada')}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Teléfono / Contacto</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 truncate block" title="${esc(prov.telefonos)}">${esc(prov.telefonos || prov.email_contacto || 'S/D')}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Condición Pago</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 truncate block">${esc(prov.forma_pago || 'HABITUALES')}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Histórico ARS</span>
            <span class="font-mono font-black text-emerald-600 dark:text-emerald-400 block">${fmtMoney(res.importe_ars || 0, 'ARS')}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Histórico USD</span>
            <span class="font-mono font-black text-indigo-600 dark:text-indigo-400 block">${fmtMoney(res.importe_usd || 0, 'USD')}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Período OCs</span>
            <span class="font-mono font-bold text-slate-800 dark:text-slate-200 block">${esc(res.primera_oc || '-')} → ${esc(res.ultima_oc || '-')}</span>
        </div>
    `;

    const provOcs = allOrdenes.filter(o => o.carpeta_prov === prov.carpeta && o.sistema !== 'OT_PDF');
    const provOt = allOrdenes.filter(o => o.carpeta_prov === prov.carpeta && o.sistema === 'OT_PDF');
    const provRec = prov.recepciones || [];
    const provRem = prov.remitos_mp || [];
    const provDocs = prov.documentos || [];

    document.getElementById('legajo-count-ocs').textContent = fmtInt(provOcs.length);
    document.getElementById('legajo-count-ot').textContent = fmtInt(provOt.length);
    document.getElementById('legajo-count-rec').textContent = fmtInt(provRec.length);
    document.getElementById('legajo-count-rem').textContent = fmtInt(provRem.length);
    document.getElementById('legajo-count-docs').textContent = fmtInt(provDocs.length);

    renderLegajoTabContent();

    const modal = document.getElementById('modal-carpeta-proveedor');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function renderLegajoTabContent() {
    if (!activeLegajoProv) return;
    const prov = activeLegajoProv;
    const container = document.getElementById('legajo-tab-content');

    // Highlight active tab button
    document.querySelectorAll('.legajo-tab-btn').forEach(btn => {
        const t = btn.getAttribute('data-legajo-tab');
        if (t === activeLegajoTab) {
            btn.className = 'legajo-tab-btn px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider border-b-2 border-villalba-blue text-villalba-blue cursor-pointer whitespace-nowrap';
        } else {
            btn.className = 'legajo-tab-btn px-3.5 py-2 rounded-t-xl text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer whitespace-nowrap';
        }
    });

    if (activeLegajoTab === 'ocs') {
        const list = allOrdenes.filter(o => o.carpeta_prov === prov.carpeta && o.sistema !== 'OT_PDF');
        if (list.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold text-sm">Este proveedor no registra órdenes de compra en el sistema central. Revisá la pestaña "OCs PDF Oficina Técnica" o emití una nueva OC.</div>`;
            return;
        }
        container.innerHTML = list.slice(0, 120).map(oc => {
            const rowsHtml = (oc.items || []).map(it => `
                <tr class="border-t border-slate-200/60 dark:border-white/5 text-xs">
                    <td class="py-1.5 px-2 font-mono text-slate-400">${esc(it.seq)}</td>
                    <td class="py-1.5 px-2 font-mono font-bold text-slate-700 dark:text-slate-300">${esc(it.cod)}</td>
                    <td class="py-1.5 px-2 text-slate-500">${esc(it.rubro)}</td>
                    <td class="py-1.5 px-2 font-semibold text-slate-900 dark:text-white">${esc(it.desc)}</td>
                    <td class="py-1.5 px-2 text-right font-mono">${esc(it.cant)}</td>
                    <td class="py-1.5 px-2 text-right font-mono text-emerald-500">${esc(it.rec)}</td>
                    <td class="py-1.5 px-2 text-right font-mono">${fmtMoney(it.precio, oc.moneda)}</td>
                    <td class="py-1.5 px-2 text-right font-mono font-bold">${fmtMoney(it.sub, oc.moneda)}</td>
                </tr>
            `).join('');

            return `
            <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] p-4 space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                        <span class="font-mono font-black text-sm text-villalba-blue">OC #${esc(oc.nro_oc)}</span>
                        <span class="text-xs font-mono text-slate-500">${esc(oc.fecha)}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-white/10">${esc(oc.origen)}</span>
                        ${getEstadoBadge(oc.estado)}
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-500">Req: <strong>${esc(oc.requerido_por || '-')}</strong> · Aut: <strong>${esc(oc.autoriza || '-')}</strong></span>
                        <span class="font-mono font-black text-sm text-slate-900 dark:text-white">${fmtMoney(oc.total, oc.moneda)}</span>
                        <button type="button" data-legajo-print-oc="${esc(oc.id)}"
                            class="px-2.5 py-1 rounded-lg bg-villalba-blue/15 hover:bg-villalba-blue text-villalba-blue hover:text-white text-xs font-bold cursor-pointer">
                            Imprimir OC
                        </button>
                    </div>
                </div>
                ${oc.obs ? `<p class="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg">Obs: ${esc(oc.obs)}</p>` : ''}
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="text-[10px] uppercase font-extrabold text-slate-400">
                                <th class="py-1 px-2">#</th>
                                <th class="py-1 px-2">Código</th>
                                <th class="py-1 px-2">Rubro</th>
                                <th class="py-1 px-2">Descripción / Material</th>
                                <th class="py-1 px-2 text-right">Pedido</th>
                                <th class="py-1 px-2 text-right">Recib.</th>
                                <th class="py-1 px-2 text-right">P. Unit</th>
                                <th class="py-1 px-2 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('[data-legajo-print-oc]').forEach(btn => {
            btn.addEventListener('click', () => openDetalleOcModal(btn.getAttribute('data-legajo-print-oc')));
        });
        return;
    }

    if (activeLegajoTab === 'ot') {
        const list = allOrdenes.filter(o => o.carpeta_prov === prov.carpeta && o.sistema === 'OT_PDF');
        if (list.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold text-sm">No hay OCs en PDF de Oficina Técnica para este proveedor.</div>`;
            return;
        }
        container.innerHTML = list.map(ot => {
            const det = (ot.items && ot.items[0]) ? ot.items[0].desc : ot.obs;
            return `
            <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-rose-400 text-lg">picture_as_pdf</span>
                        <span class="font-mono font-black text-xs text-indigo-500 dark:text-indigo-400">OC OT #${esc(ot.nro_oc)}</span>
                        <span class="font-mono text-xs text-slate-500">${esc(ot.fecha)}</span>
                        <span class="font-bold text-xs text-slate-800 dark:text-slate-200">${esc(ot.archivo_pdf || '')}</span>
                    </div>
                    <p class="text-xs text-slate-600 dark:text-slate-400">${esc(det)}</p>
                </div>
                <div class="text-right shrink-0">
                    <span class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 block">${ot.total > 0 ? fmtMoney(ot.total, 'ARS') : 'PDF Digitalizado'}</span>
                    <button type="button" data-legajo-print-oc="${esc(ot.id)}"
                        class="mt-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500 text-indigo-400 hover:text-white text-[11px] font-bold cursor-pointer">
                        Ver Ficha OC
                    </button>
                </div>
            </div>`;
        }).join('');
        container.querySelectorAll('[data-legajo-print-oc]').forEach(btn => {
            btn.addEventListener('click', () => openDetalleOcModal(btn.getAttribute('data-legajo-print-oc')));
        });
        return;
    }

    if (activeLegajoTab === 'recepciones') {
        const recs = prov.recepciones || [];
        if (recs.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold text-sm">No se registran recepciones de materia prima o piezas terminadas para este proveedor.</div>`;
            return;
        }
        container.innerHTML = recs.map(r => {
            const itemsHtml = (r.items || []).map(it => `
                <div class="text-xs flex flex-wrap items-center justify-between gap-2 py-1 border-t border-slate-200/50 dark:border-white/5">
                    <span><strong class="font-mono">${esc(it.cod_art || '')}</strong> · ${esc(it.detalle || it.rubro || '')}</span>
                    <span class="font-mono text-emerald-500 font-bold">Cant: ${esc(it.cant_mp || it.cant_recibida || '')} | Partida/Colada: ${esc(it.partida_mp || it.colada_o_espec || '-')}</span>
                </div>
            `).join('');
            return `
            <div class="rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 space-y-2 bg-slate-50/60 dark:bg-white/[0.02]">
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-mono font-bold">${esc(r.tipo || 'RECEPCIÓN')}</span>
                        <span class="font-mono font-bold text-slate-900 dark:text-white">Recibo #${esc(r.nro_recibo)}</span>
                        <span class="font-mono text-slate-500">${esc(r.fecha)}</span>
                    </div>
                    <div class="font-mono text-slate-500">
                        Remito Prov: <strong>${esc(r.remito_proveedor || '-')}</strong> · OC Rel: <strong>#${esc(r.nro_oc_rel || '-')}</strong>
                    </div>
                </div>
                ${itemsHtml}
            </div>`;
        }).join('');
        return;
    }

    if (activeLegajoTab === 'remitos') {
        const rems = prov.remitos_mp || [];
        if (rems.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold text-sm">No se registran remitos de envío de materia prima a este proveedor.</div>`;
            return;
        }
        container.innerHTML = rems.map(rm => {
            const itemsHtml = (rm.items || []).map(it => `
                <div class="text-xs flex flex-wrap justify-between gap-2 py-1 border-t border-slate-200/50 dark:border-white/5">
                    <span>${esc(it.detalle || '')} (${esc(it.rubro || '')})</span>
                    <span class="font-mono font-bold text-indigo-400">Partida MP: ${esc(it.partida_mp || '-')} · Cant: ${esc(it.cant || '')}</span>
                </div>
            `).join('');
            return `
            <div class="rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 space-y-2 bg-slate-50/60 dark:bg-white/[0.02]">
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span class="font-mono font-bold text-villalba-blue">Remito MP #${esc(rm.nro_remito_mp)} · ${esc(rm.fecha)}</span>
                    <span class="text-slate-500">OC Rel: #${esc(rm.nro_oc_rel || '-')} · Operador: ${esc(rm.operador_nombre || '-')}</span>
                </div>
                ${rm.observaciones ? `<p class="text-xs text-amber-500">Obs: ${esc(rm.observaciones)}</p>` : ''}
                ${itemsHtml}
            </div>`;
        }).join('');
        return;
    }

    if (activeLegajoTab === 'archivos') {
        const docs = prov.documentos || [];
        const baseFolder = `C:\\Users\\Tecnica\\Desktop\\proveedores\\${prov.carpeta}`;
        container.innerHTML = `
            <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                    <span class="font-bold text-indigo-600 dark:text-indigo-300 block">Ruta física de la carpeta en este equipo:</span>
                    <code class="font-mono text-slate-800 dark:text-white">${esc(baseFolder)}</code>
                </div>
                <button type="button" id="btn-copy-folder-path" data-path="${esc(baseFolder)}"
                    class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider cursor-pointer">
                    Copiar Ruta de Carpeta
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                <div class="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-mono">
                    <span class="material-symbols-outlined text-emerald-400 text-base">description</span>
                    RESUMEN_PROVEEDOR.txt
                </div>
                <div class="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-mono">
                    <span class="material-symbols-outlined text-amber-400 text-base">data_object</span>
                    datos_proveedor.json
                </div>
                <div class="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-mono">
                    <span class="material-symbols-outlined text-teal-400 text-base">table_View</span>
                    ordenes_de_compra_cobol.csv
                </div>
                ${docs.map(d => `
                    <div class="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-mono truncate" title="${esc(d)}">
                        <span class="material-symbols-outlined text-rose-400 text-base">picture_as_pdf</span>
                        <span class="truncate">${esc(d)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        const copyBtn = document.getElementById('btn-copy-folder-path');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard?.writeText(copyBtn.getAttribute('data-path'));
                copyBtn.textContent = '¡Ruta Copiada!';
                setTimeout(() => { copyBtn.textContent = 'Copiar Ruta de Carpeta'; }, 2000);
            });
        }
    }
}

// =========================================================================
// 5. MODAL 2: EMITIR NUEVA ORDEN DE COMPRA (MULTI-RENGLÓN)
// =========================================================================
function addRenglonRow(initial = {}) {
    const tbody = document.getElementById('oc-renglones-tbody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'renglon-oc-row';
    tr.innerHTML = `
        <td class="p-2">
            <input type="text" class="renglon-cod w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0a0f16] border border-slate-200 dark:border-white/10 font-mono text-xs"
                placeholder="9280100" value="${esc(initial.cod || '')}" />
        </td>
        <td class="p-2">
            <input type="text" class="renglon-rubro w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0a0f16] border border-slate-200 dark:border-white/10 text-xs"
                placeholder="MATERIA PRIMA" value="${esc(initial.rubro || 'MATERIA PRIMA')}" />
        </td>
        <td class="p-2">
            <input type="text" required class="renglon-desc w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0a0f16] border border-slate-200 dark:border-white/10 text-xs"
                placeholder="Descripción técnica del material, insumo o servicio..." value="${esc(initial.desc || '')}" />
        </td>
        <td class="p-2">
            <input type="number" step="any" min="0.01" required class="renglon-cant w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0a0f16] border border-slate-200 dark:border-white/10 font-mono text-xs text-right"
                value="${initial.cant || 1}" />
        </td>
        <td class="p-2">
            <input type="number" step="any" min="0" required class="renglon-precio w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0a0f16] border border-slate-200 dark:border-white/10 font-mono text-xs text-right"
                value="${initial.precio || 0}" />
        </td>
        <td class="p-2">
            <select class="renglon-iva w-full px-1.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0a0f16] border border-slate-200 dark:border-white/10 font-mono text-xs text-right">
                <option value="21">21%</option>
                <option value="10.5">10.5%</option>
                <option value="0">0%</option>
            </select>
        </td>
        <td class="p-2 text-right font-mono font-bold text-xs renglon-sub">$ 0,00</td>
        <td class="p-2 text-center">
            <button type="button" class="btn-del-renglon text-slate-400 hover:text-rose-400 cursor-pointer">
                <span class="material-symbols-outlined text-base">delete</span>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    tr.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('input', recalcNuevaOcTotals);
    });
    tr.querySelector('.btn-del-renglon').addEventListener('click', () => {
        if (tbody.querySelectorAll('.renglon-oc-row').length > 1) {
            tr.remove();
            recalcNuevaOcTotals();
        }
    });

    recalcNuevaOcTotals();
}

function recalcNuevaOcTotals() {
    const mon = document.getElementById('oc-input-moneda')?.value || 'ARS';
    let neto = 0;
    let iva = 0;

    document.querySelectorAll('#oc-renglones-tbody .renglon-oc-row').forEach(row => {
        const cant = parseFloat(row.querySelector('.renglon-cant')?.value || 0);
        const precio = parseFloat(row.querySelector('.renglon-precio')?.value || 0);
        const porcIva = parseFloat(row.querySelector('.renglon-iva')?.value || 21);
        const sub = cant * precio;
        neto += sub;
        iva += sub * (porcIva / 100);
        const subCell = row.querySelector('.renglon-sub');
        if (subCell) subCell.textContent = fmtMoney(sub, mon);
    });

    const total = neto + iva;
    document.getElementById('oc-calc-neto').textContent = fmtMoney(neto, mon);
    document.getElementById('oc-calc-iva').textContent = fmtMoney(iva, mon);
    document.getElementById('oc-calc-total').textContent = fmtMoney(total, mon);
}

function openNuevaOcModal(carpetaPreselect = null) {
    const form = document.getElementById('form-nueva-oc');
    if (form) form.reset();

    const tbody = document.getElementById('oc-renglones-tbody');
    if (tbody) tbody.innerHTML = '';
    addRenglonRow();

    if (carpetaPreselect) {
        const p = allProveedores.find(x => x.carpeta === carpetaPreselect || x.codigo_proveedor === carpetaPreselect);
        if (p) {
            document.getElementById('oc-input-proveedor').value = `${p.razon_social} [${p.codigo_proveedor}]`;
            document.getElementById('oc-input-cuit').value = p.cuit || '';
            document.getElementById('oc-input-pago').value = p.forma_pago || 'HABITUALES';
        }
    }

    const modal = document.getElementById('modal-nueva-oc');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// =========================================================================
// 6. MODAL 4: COMPROBANTE E IMPRESIÓN DE ORDEN DE COMPRA
// =========================================================================
function openDetalleOcModal(ocId) {
    const oc = allOrdenes.find(o => o.id === ocId || o.nro_oc === ocId);
    if (!oc) return;
    activeDetalleOc = oc;

    const btnEstado = document.getElementById('btn-oc-cambiar-estado');
    if (btnEstado) {
        btnEstado.textContent = isOcPending(oc.estado) ? 'Marcar Recibida / Cumplida' : 'Reabrir como Pendiente';
    }

    const itemsRows = (oc.items || []).map((it, idx) => `
        <tr class="border-b border-slate-200 dark:border-white/10 text-xs">
            <td class="py-2.5 px-3 font-mono">${esc(it.seq || String(idx + 1).padStart(2, '0'))}</td>
            <td class="py-2.5 px-3 font-mono font-bold">${esc(it.cod || '-')}</td>
            <td class="py-2.5 px-3">${esc(it.rubro || '-')}</td>
            <td class="py-2.5 px-3 font-semibold">${esc(it.desc || '-')}</td>
            <td class="py-2.5 px-3 text-right font-mono">${esc(it.cant)}</td>
            <td class="py-2.5 px-3 text-right font-mono">${fmtMoney(it.precio, oc.moneda)}</td>
            <td class="py-2.5 px-3 text-right font-mono font-bold">${fmtMoney(it.sub, oc.moneda)}</td>
        </tr>
    `).join('');

    const area = document.getElementById('print-oc-area');
    area.innerHTML = `
        <div class="border border-slate-300 dark:border-white/15 rounded-2xl p-6 space-y-5 bg-white dark:bg-[#0b111a] text-slate-900 dark:text-slate-100">
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
                <div class="flex items-center gap-3">
                    <img src="../supervisor/assets/logo.png" alt="Villalba" class="h-12 w-auto">
                    <div>
                        <h2 class="text-lg font-black uppercase tracking-wider">VILLALBA HNOS. S.A.</h2>
                        <p class="text-xs text-slate-500">Implantes Quirúrgicos e Instrumental · Administración y Planta Industrial</p>
                        <p class="text-[11px] font-mono text-slate-500">Reg. Compras SGC / ANMAT</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-extrabold uppercase tracking-widest text-villalba-blue block">ORDEN DE COMPRA</span>
                    <span class="text-2xl font-black font-mono block">N° ${esc(oc.nro_oc)}</span>
                    <span class="text-xs font-mono text-slate-500 block">Fecha: ${esc(oc.fecha)} ${esc(oc.hora || '')}</span>
                    <div class="mt-1">${getEstadoBadge(oc.estado)}</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-white/[0.03] p-4 rounded-xl border border-slate-200 dark:border-white/10">
                <div class="space-y-1">
                    <p><span class="text-slate-400 uppercase font-bold">Proveedor:</span> <strong class="text-sm uppercase">${esc(oc.proveedor)}</strong> (#${esc(oc.cod_prov)})</p>
                    <p><span class="text-slate-400 uppercase font-bold">CUIT:</span> <span class="font-mono">${esc(oc.cuit || 'S/D')}</span></p>
                    <p><span class="text-slate-400 uppercase font-bold">Condición de Pago:</span> ${esc(oc.forma_pago || 'HABITUALES')}</p>
                </div>
                <div class="space-y-1">
                    <p><span class="text-slate-400 uppercase font-bold">Sector Requirente:</span> <strong>${esc(oc.requerido_por || 'OFICINA TECNICA')}</strong></p>
                    <p><span class="text-slate-400 uppercase font-bold">Autorizado Por:</span> <strong>${esc(oc.autoriza || '-')}</strong></p>
                    <p><span class="text-slate-400 uppercase font-bold">Origen / Moneda:</span> <span class="font-mono">${esc(oc.origen)} · ${esc(oc.moneda || 'ARS')}</span></p>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b-2 border-slate-300 dark:border-white/20 text-[11px] uppercase font-extrabold text-slate-500">
                            <th class="py-2 px-3">Ítem</th>
                            <th class="py-2 px-3">Código</th>
                            <th class="py-2 px-3">Rubro</th>
                            <th class="py-2 px-3">Descripción / Especificación</th>
                            <th class="py-2 px-3 text-right">Cant.</th>
                            <th class="py-2 px-3 text-right">Precio Unit.</th>
                            <th class="py-2 px-3 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${itemsRows}</tbody>
                </table>
            </div>

            ${oc.obs ? `
            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                <strong class="uppercase text-amber-600 dark:text-amber-400 block mb-0.5">Observaciones e Instrucciones:</strong>
                ${esc(oc.obs)}
            </div>` : ''}

            <div class="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-4 border-t border-slate-200 dark:border-white/10">
                <div class="text-[11px] text-slate-500 space-y-0.5 max-w-md">
                    <p>• Indicar este N° de Orden de Compra en todo Remito y Factura.</p>
                    <p>• En entregas de Materia Prima adjuntar Certificado de Calidad de Colada / Lote.</p>
                </div>
                <div class="w-full sm:w-64 space-y-1 text-xs">
                    <div class="flex justify-between">
                        <span class="text-slate-500">Subtotal Neto:</span>
                        <span class="font-mono font-bold">${fmtMoney(oc.neto || oc.total, oc.moneda)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500">IVA:</span>
                        <span class="font-mono font-bold">${fmtMoney(oc.iva || 0, oc.moneda)}</span>
                    </div>
                    <div class="flex justify-between text-base font-black pt-1.5 border-t border-slate-300 dark:border-white/15">
                        <span>TOTAL OC:</span>
                        <span class="font-mono text-villalba-blue">${fmtMoney(oc.total, oc.moneda)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modal = document.getElementById('modal-detalle-oc');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// =========================================================================
// 7. EVENT LISTENERS & INITIALIZATION
// =========================================================================
function switchMainTab(tab) {
    currentMainTab = tab;
    const vProv = document.getElementById('view-proveedores');
    const vOc = document.getElementById('view-ordenes');
    const bProv = document.getElementById('tab-btn-proveedores');
    const bOc = document.getElementById('tab-btn-ordenes');

    if (tab === 'proveedores') {
        vProv.classList.remove('hidden');
        vOc.classList.add('hidden');
        bProv.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-villalba-blue text-white shadow-md shadow-villalba-blue/25';
        bOc.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5';
    } else {
        vProv.classList.add('hidden');
        vOc.classList.remove('hidden');
        bOc.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-villalba-blue text-white shadow-md shadow-villalba-blue/25';
        bProv.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();

    // Main Tabs
    document.getElementById('tab-btn-proveedores')?.addEventListener('click', () => switchMainTab('proveedores'));
    document.getElementById('tab-btn-ordenes')?.addEventListener('click', () => switchMainTab('ordenes'));

    // KPI Cards quick filters
    document.getElementById('kpi-card-proveedores')?.addEventListener('click', () => {
        document.getElementById('filter-prov-tipo').value = 'TODOS';
        applyProveedoresFilter();
        switchMainTab('proveedores');
    });
    document.getElementById('kpi-card-ocs')?.addEventListener('click', () => {
        document.getElementById('filter-oc-estado').value = 'TODOS';
        applyOrdenesFilter();
        switchMainTab('ordenes');
    });
    document.getElementById('kpi-card-pendientes')?.addEventListener('click', () => {
        document.getElementById('filter-oc-estado').value = 'ABIERTAS';
        applyOrdenesFilter();
        switchMainTab('ordenes');
    });
    document.getElementById('kpi-card-recepciones')?.addEventListener('click', () => {
        document.getElementById('filter-prov-tipo').value = 'CON_RECEPCIONES';
        applyProveedoresFilter();
        switchMainTab('proveedores');
    });

    // Suppliers filters & pagination
    document.getElementById('search-proveedores')?.addEventListener('input', applyProveedoresFilter);
    document.getElementById('filter-prov-tipo')?.addEventListener('change', applyProveedoresFilter);
    document.getElementById('sort-proveedores')?.addEventListener('change', applyProveedoresFilter);
    document.getElementById('prov-prev-btn')?.addEventListener('click', () => {
        if (provPage > 1) { provPage--; renderProveedoresGrid(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('prov-next-btn')?.addEventListener('click', () => {
        provPage++; renderProveedoresGrid(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Orders filters & pagination
    document.getElementById('search-ordenes')?.addEventListener('input', applyOrdenesFilter);
    document.getElementById('filter-oc-estado')?.addEventListener('change', applyOrdenesFilter);
    document.getElementById('filter-oc-origen')?.addEventListener('change', applyOrdenesFilter);
    document.getElementById('filter-oc-moneda')?.addEventListener('change', applyOrdenesFilter);
    document.getElementById('oc-prev-btn')?.addEventListener('click', () => {
        if (ocPage > 1) { ocPage--; renderOrdenesTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('oc-next-btn')?.addEventListener('click', () => {
        ocPage++; renderOrdenesTable(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Legajo Modal
    document.getElementById('btn-cerrar-legajo')?.addEventListener('click', () => {
        document.getElementById('modal-carpeta-proveedor').classList.add('hidden');
    });
    document.querySelectorAll('.legajo-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeLegajoTab = btn.getAttribute('data-legajo-tab');
            renderLegajoTabContent();
        });
    });
    document.getElementById('btn-legajo-nueva-oc')?.addEventListener('click', () => {
        if (activeLegajoProv) {
            document.getElementById('modal-carpeta-proveedor').classList.add('hidden');
            openNuevaOcModal(activeLegajoProv.carpeta);
        }
    });
    document.getElementById('btn-legajo-editar-prov')?.addEventListener('click', () => {
        if (!activeLegajoProv) return;
        const p = activeLegajoProv;
        document.getElementById('modal-prov-titulo').textContent = `Editar Proveedor #${p.codigo_proveedor}`;
        document.getElementById('prov-edit-carpeta').value = p.carpeta;
        document.getElementById('prov-input-razon').value = p.razon_social || '';
        document.getElementById('prov-input-codigo').value = p.codigo_proveedor || '';
        document.getElementById('prov-input-cuit').value = p.cuit || '';
        document.getElementById('prov-input-pago').value = p.forma_pago || 'HABITUALES';
        document.getElementById('prov-input-sgc').value = p.homologado_sgc ? (p.categoria_sgc || 'Producto') : 'NO';
        document.getElementById('prov-input-dir').value = p.domicilio || '';
        document.getElementById('prov-input-loc').value = p.localidad || '';
        document.getElementById('prov-input-tel').value = p.telefonos || '';
        document.getElementById('prov-input-email').value = p.email_contacto || '';
        document.getElementById('prov-input-rubro').value = p.rubro_sgc || '';

        const m = document.getElementById('modal-proveedor-form');
        m.classList.remove('hidden');
        m.classList.add('flex');
    });

    // Nueva OC Modal
    document.getElementById('btn-nueva-oc')?.addEventListener('click', () => openNuevaOcModal());
    document.getElementById('btn-cerrar-nueva-oc')?.addEventListener('click', () => {
        document.getElementById('modal-nueva-oc').classList.add('hidden');
    });
    document.getElementById('btn-cancelar-nueva-oc')?.addEventListener('click', () => {
        document.getElementById('modal-nueva-oc').classList.add('hidden');
    });
    document.getElementById('btn-agregar-renglon')?.addEventListener('click', () => addRenglonRow());
    document.getElementById('oc-input-moneda')?.addEventListener('change', recalcNuevaOcTotals);

    // Autocomplete CUIT & Pago when selecting supplier
    document.getElementById('oc-input-proveedor')?.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        const found = allProveedores.find(p =>
            `${p.razon_social} [${p.codigo_proveedor}]`.toUpperCase() === val ||
            p.razon_social.toUpperCase() === val
        );
        if (found) {
            document.getElementById('oc-input-cuit').value = found.cuit || '';
            document.getElementById('oc-input-pago').value = found.forma_pago || 'HABITUALES';
        }
    });

    // Submit Nueva OC
    document.getElementById('form-nueva-oc')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const provRaw = document.getElementById('oc-input-proveedor').value.trim();
        const matchProv = allProveedores.find(p =>
            provRaw.toUpperCase().includes(p.razon_social.toUpperCase()) ||
            (p.codigo_proveedor && provRaw.includes(`[${p.codigo_proveedor}]`))
        );

        const items = [];
        let neto = 0;
        let iva = 0;
        document.querySelectorAll('#oc-renglones-tbody .renglon-oc-row').forEach((row, idx) => {
            const cant = parseFloat(row.querySelector('.renglon-cant').value || 1);
            const precio = parseFloat(row.querySelector('.renglon-precio').value || 0);
            const porcIva = parseFloat(row.querySelector('.renglon-iva').value || 21);
            const sub = cant * precio;
            neto += sub;
            iva += sub * (porcIva / 100);
            items.push({
                seq: String(idx + 1).padStart(2, '0'),
                cod: row.querySelector('.renglon-cod').value.trim() || `ITM-${idx + 1}`,
                rubro: row.querySelector('.renglon-rubro').value.trim() || 'GENERAL',
                desc: row.querySelector('.renglon-desc').value.trim(),
                cant,
                rec: 0,
                cumplido: '',
                precio,
                iva: porcIva,
                sub
            });
        });

        const nextSeq = 6500 + getLocalJSON(LS_CUSTOM_OCS, []).length + 1;
        const nroOcFmt = `0004-${String(nextSeq).padStart(8, '0')}`;
        const today = new Date().toISOString().slice(0, 10);
        const nowTime = new Date().toTimeString().slice(0, 8);

        const newOc = {
            id: `WEB-${Date.now()}`,
            nro_oc: nroOcFmt,
            nro_corto: String(nextSeq),
            origen: 'WEB',
            sistema: 'WEB',
            cod_prov: matchProv ? matchProv.codigo_proveedor : 'WEB',
            carpeta_prov: matchProv ? matchProv.carpeta : '',
            proveedor: matchProv ? matchProv.razon_social : provRaw.toUpperCase(),
            cuit: document.getElementById('oc-input-cuit').value.trim() || (matchProv?.cuit || ''),
            fecha: today,
            hora: nowTime,
            requerido_por: document.getElementById('oc-input-sector').value,
            autoriza: document.getElementById('oc-input-autoriza').value.trim().toUpperCase(),
            forma_pago: document.getElementById('oc-input-pago').value.trim().toUpperCase(),
            moneda: document.getElementById('oc-input-moneda').value,
            estado: 'ABIERTA_PENDIENTE',
            neto: Math.round(neto * 100) / 100,
            iva: Math.round(iva * 100) / 100,
            total: Math.round((neto + iva) * 100) / 100,
            obs: document.getElementById('oc-input-obs').value.trim(),
            cant_items: items.length,
            items,
            createdAt: new Date().toISOString()
        };

        const customList = getLocalJSON(LS_CUSTOM_OCS, []);
        customList.unshift(newOc);
        setLocalJSON(LS_CUSTOM_OCS, customList);

        try {
            await addDoc(collection(db, "ordenes_compra_proveedores"), newOc);
        } catch (err) {
            console.warn("Guardado en modo local:", err?.message);
        }

        allOrdenes.unshift(newOc);
        if (matchProv) {
            matchProv.resumen.total_oc_cobol = (matchProv.resumen.total_oc_cobol || 0) + 1;
            matchProv.resumen.total_oc = (matchProv.resumen.total_oc || 0) + 1;
            matchProv.resumen.ultima_oc = today;
        }

        document.getElementById('modal-nueva-oc').classList.add('hidden');
        updateKPIs();
        applyProveedoresFilter();
        applyOrdenesFilter();
        switchMainTab('ordenes');
        openDetalleOcModal(newOc.id);
    });

    // Nuevo / Editar Proveedor Modal
    document.getElementById('btn-nuevo-proveedor')?.addEventListener('click', () => {
        document.getElementById('form-proveedor').reset();
        document.getElementById('prov-edit-carpeta').value = '';
        document.getElementById('modal-prov-titulo').textContent = 'Nuevo Proveedor';
        const m = document.getElementById('modal-proveedor-form');
        m.classList.remove('hidden');
        m.classList.add('flex');
    });
    document.getElementById('btn-cerrar-prov-form')?.addEventListener('click', () => {
        document.getElementById('modal-proveedor-form').classList.add('hidden');
    });
    document.getElementById('btn-cancelar-prov-form')?.addEventListener('click', () => {
        document.getElementById('modal-proveedor-form').classList.add('hidden');
    });

    document.getElementById('form-proveedor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editCarpeta = document.getElementById('prov-edit-carpeta').value;
        const razon = document.getElementById('prov-input-razon').value.trim().toUpperCase();
        const cod = document.getElementById('prov-input-codigo').value.trim() || String(90000 + allProveedores.length);
        const sgcVal = document.getElementById('prov-input-sgc').value;
        const carpetaKey = editCarpeta || `${razon} [${cod}]`;

        let target = allProveedores.find(p => p.carpeta === carpetaKey);
        const updatedFields = {
            carpeta: carpetaKey,
            codigo_proveedor: cod,
            razon_social: razon,
            cuit: document.getElementById('prov-input-cuit').value.trim(),
            forma_pago: document.getElementById('prov-input-pago').value.trim().toUpperCase(),
            homologado_sgc: sgcVal !== 'NO',
            categoria_sgc: sgcVal !== 'NO' ? sgcVal : '',
            domicilio: document.getElementById('prov-input-dir').value.trim(),
            localidad: document.getElementById('prov-input-loc').value.trim(),
            telefonos: document.getElementById('prov-input-tel').value.trim(),
            email_contacto: document.getElementById('prov-input-email').value.trim(),
            rubro_sgc: document.getElementById('prov-input-rubro').value.trim(),
        };

        if (target) {
            Object.assign(target, updatedFields);
        } else {
            target = {
                ...updatedFields,
                codigos_ot: [],
                resumen: {
                    total_oc_cobol: 0, total_oc_ot: 0, total_oc: 0,
                    importe_ars: 0, importe_usd: 0, primera_oc: '', ultima_oc: '',
                    total_recepciones: 0, total_remitos_mp: 0, total_documentos: 0
                },
                recepciones: [], remitos_mp: [], documentos: []
            };
            allProveedores.unshift(target);
        }

        const customMap = getLocalJSON(LS_CUSTOM_PROV, {});
        customMap[carpetaKey] = target;
        setLocalJSON(LS_CUSTOM_PROV, customMap);

        try {
            await setDoc(doc(db, "proveedores_erp", cod), updatedFields, { merge: true });
        } catch (err) {
            console.warn("Proveedor guardado localmente:", err?.message);
        }

        document.getElementById('modal-proveedor-form').classList.add('hidden');
        populateSupplierDatalist();
        updateKPIs();
        applyProveedoresFilter();
        if (activeLegajoProv && activeLegajoProv.carpeta === carpetaKey) {
            openLegajoProveedor(carpetaKey);
        }
    });

    // Detalle OC Modal & Estado Toggle
    document.getElementById('btn-cerrar-detalle-oc')?.addEventListener('click', () => {
        document.getElementById('modal-detalle-oc').classList.add('hidden');
    });
    document.getElementById('btn-oc-cambiar-estado')?.addEventListener('click', () => {
        if (!activeDetalleOc) return;
        const newEst = isOcPending(activeDetalleOc.estado) ? 'CUMPLIDA_RECIBIDA' : 'ABIERTA_PENDIENTE';
        activeDetalleOc.estado = newEst;

        const overrides = getLocalJSON(LS_STATUS_OVERRIDES, {});
        overrides[activeDetalleOc.id] = newEst;
        setLocalJSON(LS_STATUS_OVERRIDES, overrides);

        updateKPIs();
        applyOrdenesFilter();
        openDetalleOcModal(activeDetalleOc.id);
    });

    // Exportar CSV
    document.getElementById('btn-exportar-csv')?.addEventListener('click', () => {
        let csv = '\uFEFF';
        if (currentMainTab === 'proveedores') {
            csv += 'Codigo;Razon_Social;CUIT;Localidad;Homologado_SGC;OCs_Sistema;OCs_OT;Total_ARS;Total_USD;Ultima_OC\n';
            filteredProveedores.forEach(p => {
                const r = p.resumen || {};
                csv += `"${p.codigo_proveedor}";"${p.razon_social}";"${p.cuit}";"${p.localidad}";"${p.homologado_sgc ? 'SI' : 'NO'}";${r.total_oc_cobol || 0};${r.total_oc_ot || 0};${r.importe_ars || 0};${r.importe_usd || 0};"${r.ultima_oc || ''}"\n`;
            });
        } else {
            csv += 'Nro_OC;Fecha;Origen;Codigo_Prov;Proveedor;CUIT;Moneda;Importe_Total;Estado;Requerido_Por\n';
            filteredOrdenes.forEach(o => {
                csv += `"${o.nro_oc}";"${o.fecha}";"${o.origen}";"${o.cod_prov}";"${o.proveedor}";"${o.cuit}";"${o.moneda}";${o.total || 0};"${o.estado}";"${o.requerido_por || ''}"\n`;
            });
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentMainTab === 'proveedores' ? 'proveedores_villalba.csv' : 'ordenes_compra_villalba.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
});
