import {
    db, auth, doc, getDoc, collection, query, where, getDocs, orderBy, limit,
    serverTimestamp, registrarHistorial
} from './firebase-config.js';
import { runTransaction } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const searchInput = document.getElementById('prestamo-search-input');
const searchBtn = document.getElementById('search-btn');
const menuBtn = document.getElementById('menu-btn');
const resultsContainer = document.getElementById('results-container');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');

// Mapa en memoria de los consumos elegibles para sticker en la búsqueda actual
const stickerRegistry = new Map();
let pendingStickerData = null;
let isPrintingInProgress = false;

const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Función auxiliar para formatear fechas de manera legible
function formatDate(timestamp) {
    if (!timestamp) return 'Fecha desconocida';
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    return new Date(timestamp).toLocaleString('es-ES');
}

function formatDateShort(timestamp) {
    if (!timestamp) return 'Actualidad';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

// ID determinístico único por Préstamo + Caja + Código + Serie Retirada
function getStickerDocId(prestamoNum, cajaSerie, itemCode, serieAnterior) {
    const raw = `${prestamoNum}__${cajaSerie}__${itemCode}__${serieAnterior}`.toUpperCase().trim();
    return raw.replace(/[^A-Z0-9_-]/g, '_');
}

// Generador Code39 SVG puro (sin dependencias externas) para el número de serie
const CODE39_MAP = {
    '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw',
    '5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
    'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn',
    'F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
    'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn',
    'P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
    'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn',
    'Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','$':'nwnwnwnnn',
    '/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn'
};

function buildCode39Svg(text) {
    const clean = String(text || '0').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '');
    const full = `*${clean}*`;
    let x = 0;
    const narrow = 1.6;
    const wide = 3.8;
    const gap = 1.6;
    const height = 28;
    const rects = [];

    for (let i = 0; i < full.length; i++) {
        const pattern = CODE39_MAP[full[i]] || CODE39_MAP['-'];
        for (let j = 0; j < 9; j++) {
            const w = pattern[j] === 'w' ? wide : narrow;
            if (j % 2 === 0) {
                rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="#000"/>`);
            }
            x += w;
        }
        x += gap;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x.toFixed(1)} ${height}" class="w-full h-7" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

function buildStickerHtml(item) {
    const barcodeSvg = buildCode39Svg(item.serieAnterior);
    const fechaTxt = item.entradaStrShort || formatDateShort(item.entrada);
    return `
        <div style="font-family:'Public Sans',sans-serif;border:1.5px solid #0f172a;border-radius:6px;padding:6px 8px;background:#fff;color:#0f172a;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:4px;">
                <span style="font-size:9px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">VILLALBA HNOS. S.A.</span>
                <span style="font-size:8px;font-weight:800;background:#0f172a;color:#fff;padding:1px 4px;border-radius:3px;">ANMAT TRAZ.</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;">
                <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;">COD: ${esc(item.code)}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;">PRÉST. #${esc(item.prestamoNum)}</span>
            </div>
            <div style="font-size:9px;font-weight:700;line-height:1.2;margin:2px 0 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(item.desc)}
            </div>
            <div style="background:#f8fafc;border:1px solid #94a3b8;border-radius:4px;padding:3px 5px;text-align:center;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                    <span style="font-size:8px;font-weight:800;text-transform:uppercase;color:#475569;">SERIE (SN)</span>
                    <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:900;letter-spacing:0.08em;">${esc(item.serieAnterior)}</span>
                </div>
                ${barcodeSvg}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:8px;font-weight:700;color:#334155;margin-top:3px;">
                <span>CAJA: ${esc(item.cajaSerie)}</span>
                <span>CIERRE: ${esc(fechaTxt)}</span>
            </div>
        </div>
    `;
}

async function buscarPrestamo() {
    const prestamoNum = searchInput.value.trim();

    if (!prestamoNum) {
        alert("Por favor, ingresa un número de préstamo.");
        return;
    }

    resultsContainer.innerHTML = '';
    stickerRegistry.clear();
    loadingState.classList.remove('hidden');
    loadingState.classList.add('flex');
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        const docRef = doc(db, "prestamos", prestamoNum);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            await renderResult(prestamoNum, data);
            loadingState.classList.add('hidden');
            loadingState.classList.remove('flex');
        } else {
            resultsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 glass-card rounded-[2rem] border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10">
                    <span class="material-symbols-outlined text-4xl mb-3 text-amber-500">search_off</span>
                    <p class="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 text-center">
                        No se encontró ningún registro para el préstamo N° <span class="text-amber-700 dark:text-amber-400 font-black">${esc(prestamoNum)}</span>
                    </p>
                </div>
            `;
            loadingState.classList.add('hidden');
            loadingState.classList.remove('flex');
        }
    } catch (error) {
        console.error("Error al buscar el préstamo:", error);
        loadingState.classList.add('hidden');
        loadingState.classList.remove('flex');
        errorState.classList.remove('hidden');
        errorState.classList.add('flex');
    }
}

async function renderResult(prestamoNum, data) {
    let cajas = [];

    if (data.cajas && Array.isArray(data.cajas)) {
        cajas = data.cajas;
    } else if (data.cajaSerie) {
        cajas.push({
            cajaSerie: data.cajaSerie,
            modelName: data.modelName || 'Modelo no especificado'
        });
    }

    const card = document.createElement('div');
    card.className = 'glass-card rounded-[2rem] border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xl';

    const headerHtml = `
        <div class="p-6 md:p-8 bg-slate-50 dark:bg-surface-dark/50 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-xl bg-villalba-blue/10 flex items-center justify-center text-villalba-blue">
                        <span class="material-symbols-outlined">description</span>
                    </div>
                    <span class="text-xl md:text-2xl font-black text-villalba-blue dark:text-blue-400 tracking-tight">
                        Préstamo #${esc(prestamoNum)}
                    </span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span class="material-symbols-outlined text-[18px]">calendar_today</span>
                    <span class="text-xs font-bold tracking-widest uppercase">${formatDate(data.timestamp)}</span>
                </div>
            </div>
            <div class="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest pt-2">
                <span class="material-symbols-outlined text-[16px]">person</span>
                Generado por: <span class="text-slate-800 dark:text-slate-200 ml-1">${esc(data.usuarioNombre || data.usuarioEmail || 'Usuario desconocido')}</span>
                ${data.usuarioEmail ? `<span class="text-slate-400 lowercase ml-1 tracking-normal">(${esc(data.usuarioEmail)})</span>` : ''}
            </div>
        </div>
    `;

    let bodyHtml = '<div class="p-6 md:p-8 flex flex-col gap-6">';

    if (cajas.length > 0) {
        bodyHtml += `
            <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-4">
                <span class="material-symbols-outlined text-villalba-blue">inventory_2</span>
                Cajas Asociadas (${cajas.length})
            </h4>
            <div class="flex flex-col gap-6">
        `;

        const boxPromises = cajas.map(caja => getBoxDetails(caja, prestamoNum, data.timestamp, data.usuarioNombre || data.usuarioEmail));
        const boxDetailsList = await Promise.all(boxPromises);

        boxDetailsList.forEach((details, index) => {
            bodyHtml += renderBoxItem(details, index, prestamoNum);
        });

        bodyHtml += `</div>`;
    } else {
        bodyHtml += `
            <div class="flex flex-col items-center justify-center py-10">
                <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">inventory</span>
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">No se encontraron cajas asociadas</span>
            </div>
        `;
    }

    bodyHtml += '</div>';

    card.innerHTML = '';
    card.insertAdjacentHTML('beforeend', headerHtml);
    card.insertAdjacentHTML('beforeend', bodyHtml);

    resultsContainer.appendChild(card);

    // Conectar botones de impresión de sticker único
    card.querySelectorAll('[data-print-sticker]').forEach(btn => {
        btn.addEventListener('click', () => {
            const stickerId = btn.getAttribute('data-print-sticker');
            openStickerConfirmModal(stickerId);
        });
    });
}

// Función para obtener los detalles profundos de cada caja (Salida, Entrada, Consumos + Estado de Stickers)
async function getBoxDetails(caja, prestamoNum, loanTimestamp, loanUser) {
    const result = {
        cajaSerie: caja.cajaSerie,
        modelName: caja.modelName,
        salida: null,
        salidaUser: null,
        entrada: null,
        entradaUser: null,
        consumos: []
    };

    try {
        const qSalida = query(
            collection(db, "movimientos_cajas"),
            where("prestamoNum", "==", prestamoNum),
            where("cajaSerie", "==", caja.cajaSerie),
            where("tipo", "==", "Salida"),
            limit(1)
        );
        const snapSalida = await getDocs(qSalida);

        let salidaTime = null;
        if (!snapSalida.empty) {
            salidaTime = snapSalida.docs[0].data().timestamp;
            result.salidaUser = snapSalida.docs[0].data().usuarioNombre || snapSalida.docs[0].data().usuarioEmail;
        } else {
            salidaTime = loanTimestamp;
            result.salidaUser = loanUser;
        }
        result.salida = salidaTime;

        if (!salidaTime) return result;

        const qEntrada = query(
            collection(db, "movimientos_cajas"),
            where("cajaSerie", "==", caja.cajaSerie),
            where("tipo", "==", "Entrada"),
            where("timestamp", ">", salidaTime),
            orderBy("timestamp", "asc"),
            limit(1)
        );
        const snapEntrada = await getDocs(qEntrada);

        if (!snapEntrada.empty) {
            result.entrada = snapEntrada.docs[0].data().timestamp;
            result.entradaUser = snapEntrada.docs[0].data().usuarioNombre || snapEntrada.docs[0].data().usuarioEmail;
        }

        let nextSalidaTime = null;
        if (result.entrada) {
            const qNextSalida = query(
                collection(db, "movimientos_cajas"),
                where("cajaSerie", "==", caja.cajaSerie),
                where("tipo", "==", "Salida"),
                where("timestamp", ">", result.entrada),
                orderBy("timestamp", "asc"),
                limit(1)
            );
            const snapNextSalida = await getDocs(qNextSalida);
            if (!snapNextSalida.empty) {
                nextSalidaTime = snapNextSalida.docs[0].data().timestamp;
            }
        }

        const qHistorial = query(
            collection(db, "historial"),
            where("detalles.cajaSerie", "==", caja.cajaSerie)
        );
        const snapHistorial = await getDocs(qHistorial);

        snapHistorial.forEach(hDoc => {
            const h = hDoc.data();

            const hDate = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
            const sDate = salidaTime?.toDate ? salidaTime.toDate() : new Date(salidaTime);
            if (hDate < sDate) return;

            if (h.accion === 'MODIFICACIÓN DE ÍTEM' && h.detalles && h.detalles.valorNuevo === 'REEMPLAZAR') {
                let isRelevant = true;
                if (result.entrada) {
                    const entradaDate = result.entrada.toDate ? result.entrada.toDate() : new Date(result.entrada);
                    const historialDate = h.timestamp.toDate ? h.timestamp.toDate() : new Date(h.timestamp);

                    if (nextSalidaTime) {
                        const nextSalidaDate = nextSalidaTime.toDate ? nextSalidaTime.toDate() : new Date(nextSalidaTime);
                        if (historialDate >= nextSalidaDate) {
                            isRelevant = false;
                        }
                    }

                    const diffTime = Math.abs(historialDate - entradaDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (historialDate > entradaDate && diffDays > 2) {
                        isRelevant = false;
                    }
                }

                if (isRelevant) {
                    result.consumos.push({
                        codigoDesc: h.detalles.itemDescripcion,
                        serieAnterior: h.detalles.valorAnterior,
                        fecha: h.timestamp,
                        stickerInfo: null
                    });
                }
            }
        });

        // Consultar en Firestore si cada ítem consumido ya tuvo su sticker impreso
        await Promise.all(result.consumos.map(async (c) => {
            const parts = (c.codigoDesc || '').split(';');
            const code = parts[0] || '?';
            const stickerId = getStickerDocId(prestamoNum, caja.cajaSerie, code, c.serieAnterior);
            try {
                const stSnap = await getDoc(doc(db, "stickers_anmat_impresos", stickerId));
                if (stSnap.exists()) {
                    c.stickerInfo = stSnap.data();
                }
            } catch (err) {
                console.warn("No se pudo verificar estado del sticker:", stickerId, err);
            }
        }));

    } catch (e) {
        console.error("Error obteniendo detalles de la caja:", e);
    }
    return result;
}

function renderStickerActionBadge(stickerId, cicloCerrado, stickerInfo) {
    if (!cicloCerrado) {
        return `
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-bold uppercase tracking-wider" title="El ciclo debe estar cerrado (con Entrada registrada) para emitir el sticker">
                <span class="material-symbols-outlined text-[15px]">lock_clock</span>
                Ciclo abierto
            </span>
        `;
    }

    if (stickerInfo && stickerInfo.impreso) {
        const fechaImp = stickerInfo.impresoAt ? formatDate(stickerInfo.impresoAt) : '';
        const quien = stickerInfo.impresoPorNombre || stickerInfo.impresoPorEmail || 'Usuario';
        return `
            <div class="inline-flex flex-col items-end">
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-[11px] font-black uppercase tracking-wider cursor-not-allowed select-none" title="Impresión única ANMAT ya utilizada. Bloqueado permanentemente.">
                    <span class="material-symbols-outlined text-[15px] text-emerald-500">verified</span>
                    Sticker Emitido (Bloqueado)
                </span>
                <span class="text-[10px] text-slate-400 mt-1">
                    Por ${esc(quien)}${fechaImp ? ` · ${esc(fechaImp)}` : ''}
                </span>
            </div>
        `;
    }

    return `
        <button type="button" data-print-sticker="${esc(stickerId)}"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 transition-all cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">print</span>
            Imprimir Sticker (1x)
        </button>
    `;
}

function renderBoxItem(details, index, prestamoNum) {
    const salidaStr = formatDate(details.salida);
    const cicloCerrado = Boolean(details.entrada);
    const entradaStr = cicloCerrado
        ? formatDate(details.entrada)
        : '<span class="text-amber-500 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">warning</span> Pendiente de retorno</span>';

    let consumosHtml = '';
    if (details.consumos.length > 0) {
        const periodoTexto = `${formatDateShort(details.salida)} al ${formatDateShort(details.entrada)}`;

        consumosHtml = `
            <div class="mt-6 rounded-2xl bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 overflow-hidden">
                <div class="px-5 py-3 border-b border-rose-100 dark:border-rose-500/20 flex items-center justify-between bg-rose-100/50 dark:bg-rose-500/10">
                    <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest text-xs">
                        <span class="material-symbols-outlined text-[18px]">build</span>
                        Ítems Consumidos
                    </div>
                    <span class="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold text-[10px] tracking-widest uppercase shadow-sm">
                        Ciclo: ${periodoTexto}
                    </span>
                </div>
                <div class="p-5 flex flex-col gap-3">
        `;

        details.consumos.forEach(c => {
            const parts = (c.codigoDesc || '').split(';');
            const code = parts[0] || '?';
            const desc = parts[1] || '?';
            const fechaConsumo = formatDate(c.fecha);
            const stickerId = getStickerDocId(prestamoNum, details.cajaSerie, code, c.serieAnterior);

            stickerRegistry.set(stickerId, {
                stickerId,
                prestamoNum,
                cajaSerie: details.cajaSerie,
                modelName: details.modelName,
                code,
                desc,
                serieAnterior: c.serieAnterior,
                fechaConsumo,
                salida: details.salida,
                entrada: details.entrada,
                entradaStrShort: formatDateShort(details.entrada),
                cicloCerrado,
                stickerInfo: c.stickerInfo
            });

            consumosHtml += `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div class="flex flex-col gap-1">
                        <span class="font-black text-slate-800 dark:text-white text-base">${esc(code)}</span>
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">${esc(desc)}</span>
                        <span class="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                            <span class="material-symbols-outlined text-[14px]">event</span> ${esc(fechaConsumo)}
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end">
                        <div class="flex flex-col items-start md:items-end">
                            <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Serie Retirada</span>
                            <span class="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black tracking-widest border border-rose-200 dark:border-rose-500/20 font-mono">
                                ${esc(c.serieAnterior)}
                            </span>
                        </div>
                        <div id="sticker-slot-${esc(stickerId)}" class="flex items-center">
                            ${renderStickerActionBadge(stickerId, cicloCerrado, c.stickerInfo)}
                        </div>
                    </div>
                </div>
            `;
        });
        consumosHtml += `</div></div>`;
    }

    return `
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div class="absolute -top-3 -left-3 size-8 rounded-xl bg-villalba-blue text-white flex items-center justify-center font-black shadow-lg shadow-villalba-blue/30 text-sm">
                ${index + 1}
            </div>
            
            <div class="ml-4 md:ml-6">
                <div class="mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">${esc(details.cajaSerie)}</h3>
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">${esc(details.modelName)}</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-black/20 p-4 md:p-5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <div class="flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 pb-4 md:pb-0 md:pr-4">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">logout</span> Salida
                        </span>
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${salidaStr}</span>
                        <span class="text-xs text-slate-500 font-bold mt-1 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">person</span> ${esc(details.salidaUser || 'N/A')}
                        </span>
                    </div>
                    <div class="flex flex-col pt-4 md:pt-0 md:pl-4">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">login</span> Entrada
                        </span>
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${entradaStr}</span>
                        ${details.entrada ? `
                        <span class="text-xs text-slate-500 font-bold mt-1 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">person</span> ${esc(details.entradaUser || 'N/A')}
                        </span>` : ''}
                    </div>
                </div>

                ${consumosHtml}
            </div>
        </div>
    `;
}

// =========================================================================
// MODAL Y TRANSACCIÓN ATÓMICA DE IMPRESIÓN ÚNICA (ANMAT)
// =========================================================================
function openStickerConfirmModal(stickerId) {
    const item = stickerRegistry.get(stickerId);
    if (!item || !item.cicloCerrado) return;
    if (item.stickerInfo && item.stickerInfo.impreso) {
        alert("Este sticker ya fue impreso anteriormente y está bloqueado por normativa ANMAT.");
        return;
    }

    pendingStickerData = item;
    const previewBox = document.getElementById('sticker-preview-box');
    previewBox.innerHTML = buildStickerHtml(item);

    const confirmBtn = document.getElementById('btn-confirm-print-sticker');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `<span class="material-symbols-outlined text-base">print</span> Confirmar e Imprimir (1x)`;

    const modal = document.getElementById('modal-confirm-sticker');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeStickerConfirmModal() {
    const modal = document.getElementById('modal-confirm-sticker');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    pendingStickerData = null;
}

async function confirmAndPrintUniqueSticker() {
    if (!pendingStickerData || isPrintingInProgress) return;
    const item = pendingStickerData;
    const confirmBtn = document.getElementById('btn-confirm-print-sticker');

    isPrintingInProgress = true;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">sync</span> Registrando emisión...`;

    try {
        const user = auth.currentUser;
        const userName = localStorage.getItem('userName') || user?.displayName || user?.email || 'Supervisor';
        const userEmail = user?.email || '';
        const userUid = user?.uid || '';

        const stickerDocRef = doc(db, "stickers_anmat_impresos", item.stickerId);

        // Transacción atómica en Firestore: garantiza que NUNCA pueda imprimirse 2 veces
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(stickerDocRef);
            if (snap.exists() && snap.data()?.impreso === true) {
                throw new Error('ALREADY_PRINTED');
            }
            transaction.set(stickerDocRef, {
                stickerId: item.stickerId,
                prestamoNum: item.prestamoNum,
                cajaSerie: item.cajaSerie,
                modelName: item.modelName || '',
                itemCode: item.code,
                itemDesc: item.desc,
                serieRetirada: item.serieAnterior,
                impreso: true,
                impresionesCount: 1,
                impresoPorNombre: userName,
                impresoPorEmail: userEmail,
                impresoPorUid: userUid,
                impresoAt: serverTimestamp()
            });
        });

        // Registrar auditoría en historial general
        registrarHistorial('IMPRESIÓN STICKER ANMAT', {
            prestamoNum: item.prestamoNum,
            cajaSerie: item.cajaSerie,
            itemCodigo: item.code,
            itemDescripcion: item.desc,
            serieRetirada: item.serieAnterior,
            stickerId: item.stickerId
        });

        // Actualizar estado en memoria y bloquear botón inmediatamente en la UI
        const lockedInfo = {
            impreso: true,
            impresoPorNombre: userName,
            impresoPorEmail: userEmail,
            impresoAt: new Date()
        };
        item.stickerInfo = lockedInfo;
        const slot = document.getElementById(`sticker-slot-${item.stickerId}`);
        if (slot) {
            slot.innerHTML = renderStickerActionBadge(item.stickerId, true, lockedInfo);
        }

        // Preparar área de impresión y lanzar diálogo de impresión
        const printArea = document.getElementById('sticker-print-area');
        printArea.innerHTML = buildStickerHtml(item);
        closeStickerConfirmModal();

        window.print();
    } catch (err) {
        if (err?.message === 'ALREADY_PRINTED') {
            alert("BLOQUEO ANMAT: Este sticker ya fue impreso por otro usuario o sesión. No se puede reimprimir.");
            const stSnap = await getDoc(doc(db, "stickers_anmat_impresos", item.stickerId));
            if (stSnap.exists()) {
                item.stickerInfo = stSnap.data();
                const slot = document.getElementById(`sticker-slot-${item.stickerId}`);
                if (slot) slot.innerHTML = renderStickerActionBadge(item.stickerId, true, item.stickerInfo);
            }
            closeStickerConfirmModal();
        } else {
            console.error("Error al registrar impresión única:", err);
            alert("No se pudo confirmar el registro en la base de datos. Verificá tu conexión e intentá nuevamente.");
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<span class="material-symbols-outlined text-base">print</span> Confirmar e Imprimir (1x)`;
        }
    } finally {
        isPrintingInProgress = false;
    }
}

// Limpiar el área de impresión apenas termina window.print() para impedir Ctrl+P posterior
window.addEventListener('afterprint', () => {
    const printArea = document.getElementById('sticker-print-area');
    if (printArea) printArea.innerHTML = '';
});

// Event Listeners
searchBtn.addEventListener('click', buscarPrestamo);

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        buscarPrestamo();
    }
});

if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
}

document.getElementById('btn-cancel-sticker')?.addEventListener('click', closeStickerConfirmModal);
document.getElementById('btn-cancel-sticker-2')?.addEventListener('click', closeStickerConfirmModal);
document.getElementById('btn-confirm-print-sticker')?.addEventListener('click', confirmAndPrintUniqueSticker);
