// public/produccion/js/menu.js
document.addEventListener('DOMContentLoaded', async () => {
    const userName = localStorage.getItem('userName') || 'Supervisor ERP';
    const userDisplay = document.getElementById('user-display-name');
    if (userDisplay) userDisplay.textContent = userName;

    // Cargar métricas reales de VIAORD extraídas por cobol-bridge
    try {
        const res = await fetch('../data-cobol/produccion_cobol.json');
        if (res.ok) {
            const ops = await res.json();
            const customOps = JSON.parse(localStorage.getItem('terian_produccion_ops_custom') || '[]');
            const total = ops.length + customOps.length;
            const kpiTotal = document.getElementById('kpi-total-ops');
            const kpiLast = document.getElementById('kpi-last-op');
            if (kpiTotal) kpiTotal.textContent = total;
            if (kpiLast && (customOps[0] || ops[0])) {
                const top = customOps[0] || ops[0];
                kpiLast.textContent = `Última OP: #${top.op} (${top.codigo})`;
            }
        }
    } catch (e) {
        console.warn('Usando KPIs por defecto:', e);
    }

    const createCard = ({ title, subtitle, icon, href, badge, color = 'emerald' }) => `
        <a href="${href}" class="group flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-${color}-500/50 shadow-sm hover:shadow-xl transition-all duration-200 no-underline">
            <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-2xl bg-${color}-500/10 text-${color}-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span class="material-symbols-outlined text-2xl">${icon}</span>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">${title}</h4>
                        ${badge ? `<span class="px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-${color}-500/15 text-${color}-500">${badge}</span>` : ''}
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitle}</p>
                </div>
            </div>
            <span class="material-symbols-outlined text-slate-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </a>
    `;

    const colFab = document.getElementById('col-fabricacion');
    const colCal = document.getElementById('col-calidad');

    if (colFab) {
        colFab.innerHTML = [
            createCard({
                title: 'Órdenes de Producción (VIAORD)',
                subtitle: 'Gestión de OPs, despiece de componentes, IR de Materia Prima y vínculo Monday.com',
                icon: 'engineering',
                href: 'ordenes-produccion.html',
                badge: 'VIAORD + MONDAY',
                color: 'emerald'
            }),
            createCard({
                title: 'Cuarentena y Liberación (VIAPIE)',
                subtitle: 'Control de calidad PZ3, control higiénico/estéril, rechazos y pase automático a Depósito',
                icon: 'science',
                href: 'cuarentena-piezas.html',
                badge: 'VIAPIE / PZ3',
                color: 'amber'
            }),
            createCard({
                title: 'Catálogo 3D de Implantes e Instrumental',
                subtitle: 'Visor interactivo .GLB 3D y fichas técnicas de piezas en producción',
                icon: 'view_in_ar',
                href: '../supervisor/catalogo-items.html',
                badge: '388 MODELOS 3D',
                color: 'indigo'
            })
        ].join('');
    }

    if (colCal) {
        colCal.innerHTML = [
            createCard({
                title: 'Estudio de Etiquetas Zebra ZPL',
                subtitle: 'Generador y previsualizador en vivo de etiquetas ANMAT (GS1 DataMatrix + Code39 + Labelary)',
                icon: 'qr_code_2',
                href: 'etiquetas-zebra.html',
                badge: 'ZEBRA ZPL',
                color: 'blue'
            }),
            createCard({
                title: 'Stock de Semielaborados y Materia Prima',
                subtitle: 'Acceso directo a los 4 almacenes de Depósito (No Estéril, Estéril, Semielaborado, MP)',
                icon: 'warehouse',
                href: '../deposito/catalogo.html',
                badge: '4 ALMACENES',
                color: 'purple'
            }),
            createCard({
                title: 'Solicitar Insumos / Pedidos de Planta',
                subtitle: 'Generar pedido interno o alerta de reposición de materia prima',
                icon: 'shopping_cart_checkout',
                href: '../pedidos-internos/nuevo-pedido.html',
                badge: 'COMPRAS',
                color: 'rose'
            })
        ].join('');
    }
});
