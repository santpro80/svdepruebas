// global-sidebar.js - TERIAN ERP Unificado v3.0 (COBOL WSFESA + Web Unificados)

export function initGlobalSidebar() {
    if (document.getElementById('global-sidebar-overlay')) return;

    // 1. Inject Tailwind with Preflight DISABLED
    if (typeof window.tailwind === 'undefined' && !document.getElementById('tailwind-globals')) {
        const sc = document.createElement('script');
        sc.src = "https://cdn.tailwindcss.com";
        sc.id = 'tailwind-globals';
        
        sc.onload = () => {
            const config = document.createElement('script');
            config.textContent = `
                tailwind.config = {
                    corePlugins: { preflight: false },
                    darkMode: 'class',
                    theme: { extend: { colors: { 'villalba-blue': '#2563eb' } } }
                }
            `;
            document.head.appendChild(config);
        };
        document.head.appendChild(sc);

        if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
            const font = document.createElement('link');
            font.rel = "stylesheet";
            font.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";
            document.head.appendChild(font);
        }
    }

    // 2. Apps and Context Information
    const getBase = () => {
        const path = window.location.pathname;
        const pubIdx = path.indexOf('/public/');
        if (pubIdx !== -1) {
            return path.slice(0, pubIdx + 8);
        }
        if (window.location.hostname.includes('github.io')) {
            const repo = path.split('/')[1];
            return `/${repo}/`;
        }
        return '/';
    };
    const baseRoot = getBase();

    const userRoleTrazabilidad = localStorage.getItem('userRole') || 'supervisor';
    const rawRolePedidos = localStorage.getItem('rolePedidos');
    const rawRoleDeposito = localStorage.getItem('roleDeposito');
    
    const userRolePedidos = rawRolePedidos || userRoleTrazabilidad;
    const userRoleDeposito = rawRoleDeposito || userRoleTrazabilidad;
    
    const userName = localStorage.getItem('userName') || 'Supervisor ERP';
    
    // En el sistema unificado TERIAN ERP v3.0 habilitamos los 6 módulos integrados (COBOL + Web)
    let storedApps = JSON.parse(localStorage.getItem('userApps') || '["trazabilidad","deposito","pedidos","produccion","comercial","flujos"]');
    const defaultUnifiedApps = ['trazabilidad', 'deposito', 'pedidos', 'produccion', 'comercial', 'flujos'];
    const userApps = Array.from(new Set([...storedApps, ...defaultUnifiedApps]));
    
    // Detect current app context
    const path = window.location.pathname;
    const isPedidosContext = path.includes('pedidos-internos');
    const isDepositoContext = path.includes('deposito');
    const isFlujosContext = path.includes('flujos');
    const isProduccionContext = path.includes('produccion');
    const isComercialContext = path.includes('comercial');
    const isTrazabilidadContext = !isPedidosContext && !isDepositoContext && !isFlujosContext && !isProduccionContext && !isComercialContext;
    
    let currentRole;
    if (isPedidosContext) currentRole = userRolePedidos;
    else if (isDepositoContext) currentRole = userRoleDeposito;
    else currentRole = userRoleTrazabilidad;

    const isSupervisor = currentRole === 'supervisor';
    const isMantenimiento = currentRole === 'mantenimiento';

    // 3. App Buttons HTML (6 Módulos Unificados: TZ, DP, PD, PR, CM, FL)
    let appsHtml = '';
    if (userApps.includes('trazabilidad')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}supervisor/menu.html'" class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${isTrazabilidadContext ? 'bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-9 rounded-xl bg-gradient-to-br from-[#6e8efb] to-[#a777e3] flex items-center justify-center">
                    <span class="text-white font-black text-xs">TZ</span>
                </div>
                <span class="text-[8px] font-black ${isTrazabilidadContext ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-widest text-center">Trazabilidad</span>
            </button>
        `;
    }
    if (userApps.includes('deposito')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}deposito/menu.html'" class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${isDepositoContext ? 'bg-indigo-500/20 border-indigo-500/40 shadow-lg shadow-indigo-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-9 rounded-xl bg-indigo-500 flex items-center justify-center">
                    <span class="text-white font-black text-xs">DP</span>
                </div>
                <span class="text-[8px] font-black ${isDepositoContext ? 'text-indigo-500' : 'text-slate-500'} uppercase tracking-widest text-center">Depósito</span>
            </button>
        `;
    }
    if (userApps.includes('pedidos')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}pedidos-internos/menu.html'" class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${isPedidosContext ? 'bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <span class="text-white font-black text-xs">PD</span>
                </div>
                <span class="text-[8px] font-black ${isPedidosContext ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-widest text-center">Pedidos</span>
            </button>
        `;
    }
    if (userApps.includes('produccion')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}produccion/menu.html'" class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${isProduccionContext ? 'bg-emerald-500/20 border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <span class="text-white font-black text-xs">PR</span>
                </div>
                <span class="text-[8px] font-black ${isProduccionContext ? 'text-emerald-500' : 'text-slate-500'} uppercase tracking-widest text-center">Producción</span>
            </button>
        `;
    }
    if (userApps.includes('comercial')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}comercial/menu.html'" class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${isComercialContext ? 'bg-amber-500/20 border-amber-500/40 shadow-lg shadow-amber-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <span class="text-white font-black text-xs">CM</span>
                </div>
                <span class="text-[8px] font-black ${isComercialContext ? 'text-amber-500' : 'text-slate-500'} uppercase tracking-widest text-center">Comercial</span>
            </button>
        `;
    }
    if (userApps.includes('flujos')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}flujos/index.html'" class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${isFlujosContext ? 'bg-cyan-500/20 border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                    <span class="text-white font-black text-xs">FL</span>
                </div>
                <span class="text-[8px] font-black ${isFlujosContext ? 'text-cyan-500' : 'text-slate-500'} uppercase tracking-widest text-center">Flujos</span>
            </button>
        `;
    }

    // 4. Quick Access Menu Generation
    const menuItems = [];

    if (isFlujosContext) {
        const base = `${baseRoot}flujos/`;
        menuItems.push({ label: 'Diagramas de Flujo', icon: 'account_tree', link: base + 'index.html' });
    } else if (isProduccionContext) {
        const base = `${baseRoot}produccion/`;
        menuItems.push({ label: 'Panel Producción & OP', icon: 'precision_manufacturing', link: base + 'menu.html' });
        menuItems.push({ label: 'Órdenes de Producción (VIAORD)', icon: 'engineering', link: base + 'ordenes-produccion.html' });
        menuItems.push({ label: 'Etiquetas Zebra ZPL & QR', icon: 'qr_code_2', link: base + 'etiquetas-zebra.html' });
        menuItems.push({ label: 'Cuarentena de Piezas (VIAPIE)', icon: 'science', link: base + 'cuarentena-piezas.html' });
    } else if (isComercialContext) {
        const base = `${baseRoot}comercial/`;
        menuItems.push({ label: 'Hub Comercial & Logística', icon: 'storefront', link: base + 'menu.html' });
        menuItems.push({ label: 'Remitos & Préstamos (VI0201N2)', icon: 'local_shipping', link: base + 'remitos-prestamos.html' });
        menuItems.push({ label: 'Facturación AFIP / ARCA', icon: 'receipt_long', link: base + 'facturacion-afip.html' });
        menuItems.push({ label: 'Clientes, Médicos & Sucursales', icon: 'medical_information', link: base + 'maestros-comerciales.html' });
    } else if (isPedidosContext) {
        const base = `${baseRoot}pedidos-internos/`;
        menuItems.push({ label: 'Órdenes de Compra (VIA44)', icon: 'shopping_cart_checkout', link: base + 'ordenes-compra-proveedores.html' });
        menuItems.push({ label: 'Mis Pedidos', icon: 'receipt_long', link: base + 'mis-pedidos.html' });
        menuItems.push({ label: 'Gestión Pedidos', icon: 'inventory_2', link: base + 'gestion-pedidos.html' });
        menuItems.push({ label: 'Stock Crítico', icon: 'warning', link: base + 'stock-critico.html' });
        menuItems.push({ label: 'Panel Admin', icon: 'admin_panel_settings', link: base + 'panel-admin.html' });
        menuItems.push({ label: 'Reportes', icon: 'bar_chart', link: base + 'reportes.html' });
        menuItems.push({ label: 'Configuración', icon: 'settings', link: base + 'configuracion.html' });
    } else if (isDepositoContext) {
        const base = `${baseRoot}deposito/`;
        menuItems.push({ label: 'Carga de Datos', icon: 'add_box', link: base + 'carga-datos.html' });
        menuItems.push({ label: 'Egresos Fallidos', icon: 'report_off', link: base + 'egresos-fallidos.html' });
        menuItems.push({ label: 'Historial', icon: 'history', link: base + 'historial.html' });
        if (isSupervisor) {
            menuItems.push({ label: 'Alertas de Stock', icon: 'warning', link: base + 'alertas-stock.html' });
            menuItems.push({ label: 'Listado de Ítems / Stock', icon: 'category', link: base + 'catalogo.html' });
            menuItems.push({ label: 'Estadísticas', icon: 'bar_chart', link: base + 'estadisticas.html' });
            menuItems.push({ label: 'Migración CSV / COBOL', icon: 'upload_file', link: base + 'migracion.html' });
            menuItems.push({ label: 'Ajuste de Stock', icon: 'edit_document', link: base + 'ajuste-stock.html' });
        }
    } else {
        const base = `${baseRoot}${userRoleTrazabilidad}/`;
        if (!isMantenimiento) menuItems.push({ label: 'Modelos de Cajas', icon: 'inventory_2', link: base + 'modelos-de-cajas.html' });
        const ticketLink = isSupervisor ? base + 'tickets-supervisor.html' : base + 'tickets-operador.html';
        menuItems.push({ label: 'Tickets', icon: 'confirmation_number', link: ticketLink });
        menuItems.push({ label: 'Reportar Problema', icon: 'report_problem', link: base + 'reportar-problema.html' });
        if (isSupervisor || isMantenimiento) {
            menuItems.push({ label: 'Ver Problemas', icon: 'bug_report', link: base + 'ver-problemas.html' });
        }
        if (isSupervisor) {
            menuItems.push({ label: 'Buscar por Préstamo', icon: 'find_in_page', link: base + 'buscar-por-prestamo.html' });
            menuItems.push({ label: 'Historial', icon: 'history', link: base + 'lista-historial.html' });
            menuItems.push({ label: 'Informe Diario', icon: 'today', link: base + 'informe-diario.html' });
            menuItems.push({ label: 'Estadísticas', icon: 'monitoring', link: base + 'estadisticas.html' });
            menuItems.push({ label: 'Catálogo 3D de Ítems', icon: 'view_in_ar', link: base + 'catalogo-items.html' });
            menuItems.push({ label: 'Usuarios App', icon: 'manage_accounts', link: base + 'gestion-usuarios.html' });
        }
    }

    let menuHtml = '';
    menuItems.forEach(item => {
        menuHtml += `
            <button onclick="window.location.href='${item.link}'" class="flex items-center w-full gap-4 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 border-none bg-transparent cursor-pointer group">
                <span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">${item.icon}</span>
                <span class="text-[11px] font-bold uppercase tracking-wide flex-1 text-left">${item.label}</span>
            </button>
        `;
    });

    const getMainMenuUrl = () => {
        if (isPedidosContext) return baseRoot + 'pedidos-internos/menu.html';
        if (isDepositoContext) return baseRoot + 'deposito/menu.html';
        if (isProduccionContext) return baseRoot + 'produccion/menu.html';
        if (isComercialContext) return baseRoot + 'comercial/menu.html';
        if (isFlujosContext) return baseRoot + 'flujos/index.html';
        return baseRoot + userRoleTrazabilidad + '/menu.html';
    };

    // 5. Drawer HTML
    const sidebarHtml = `
        <div id="global-sidebar-overlay" style="display: none;" class="fixed inset-0 bg-black/60 z-[99998] hidden backdrop-blur-sm transition-opacity" onclick="toggleGlobalSidebar()"></div>
        <aside id="global-side-drawer" style="display: none; font-family: 'Inter', sans-serif;" class="fixed inset-y-0 left-0 z-[99999] w-72 bg-slate-50 dark:bg-[#161e2a] border-r border-slate-200 dark:border-slate-800 transform -translate-x-full transition-transform duration-300 flex flex-col p-6 shadow-2xl text-slate-900 dark:text-slate-100 h-full overflow-hidden">
            <div class="flex items-center justify-between mb-6 shrink-0">
                <div class="flex flex-col">
                    <span class="text-sm font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">TERIAN ERP</span>
                    <span class="text-[9px] font-bold tracking-[0.18em] uppercase text-villalba-blue leading-none mt-1">Villalba Unificado v3.0</span>
                </div>
                <button onclick="toggleGlobalSidebar()" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-200 dark:bg-slate-800/50 p-1.5 rounded-lg border-none cursor-pointer">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>

            <!-- App Switcher (6 Módulos) -->
            <div class="mb-5 shrink-0">
                <h3 class="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-2.5 px-1">Módulos del Sistema</h3>
                <div class="grid grid-cols-3 gap-2">
                    ${appsHtml}
                </div>
            </div>

            <!-- Main Buttons -->
            <div class="flex flex-col gap-2 mb-5 shrink-0">
                <button onclick="window.location.href='${baseRoot}sincronizador-erp.html'" class="flex items-center w-full gap-4 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md border-none cursor-pointer group">
                    <span class="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform">hub</span>
                    <span class="text-[11px] font-black uppercase tracking-widest flex-1 text-left">Centro Control ERP v3.0</span>
                </button>
                <button onclick="window.location.href='${getMainMenuUrl()}'" class="flex items-center w-full gap-4 p-3 rounded-xl bg-villalba-blue text-white shadow-lg shadow-blue-500/20 border-none cursor-pointer group">
                    <span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">grid_view</span>
                    <span class="text-[11px] font-black uppercase tracking-widest flex-1 text-left">Menú del Módulo</span>
                </button>
                <button onclick="toggleGlobalTheme()" class="flex items-center w-full gap-4 p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                    <span class="material-symbols-outlined text-[20px] theme-icon-global group-hover:rotate-12 transition-transform">dark_mode</span>
                    <span class="text-[11px] font-bold uppercase tracking-wide flex-1 text-left theme-text-global">Modo Oscuro</span>
                </button>
            </div>

            <!-- Quick Access -->
            <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                <h3 class="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-2.5 px-1">Acceso Directo</h3>
                <nav class="flex flex-col gap-1">
                    ${menuHtml}
                </nav>
            </div>

            <!-- Bottom Section -->
            <div class="mt-auto pt-4 shrink-0 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800">
                <button onclick="handleGlobalLogout()" class="flex items-center w-full gap-4 p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-rose-500 border-none bg-transparent cursor-pointer group font-bold">
                    <span class="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">logout</span>
                    <span class="text-xs uppercase tracking-wide">Cerrar Sesión</span>
                </button>
                
                <!-- Profile Section -->
                <div class="flex items-center gap-3 p-2.5 bg-slate-200/50 dark:bg-slate-800/40 rounded-xl border border-slate-300 dark:border-slate-800">
                    <div class="size-9 rounded-full bg-villalba-blue flex items-center justify-center text-white shrink-0 font-black shadow-inner">
                        ${userName.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-xs font-bold text-slate-900 dark:text-white truncate uppercase">${userName}</span>
                        <span class="text-[10px] text-slate-500 uppercase tracking-widest truncate">${currentRole}</span>
                    </div>
                </div>
            </div>
        </aside>
        <style>
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', sidebarHtml);

    // Hamburger button injection
    const headerLeft = document.querySelector('.header-left');
    if (!headerLeft && !document.getElementById('global-hamburger-btn')) {
        const fabHtml = `
            <button id="global-hamburger-btn" onclick="toggleGlobalSidebar()" class="no-print" style="position:fixed; bottom:20px; left:20px; z-index:9990; background:#0f172a; color:#fff; border:1px solid rgba(99,102,241,0.5); border-radius:9999px; padding:10px 16px; font-family:Inter,sans-serif; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 10px 25px rgba(15,23,42,0.4);">
                <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:#10b981;"></span>
                <span>MÓDULOS ERP v3.0</span>
            </button>
        `;
        document.body.insertAdjacentHTML('beforeend', fabHtml);
    }
    if (headerLeft && !document.getElementById('global-hamburger-btn')) {
        const hamburgerHtml = `
            <button id="global-hamburger-btn" onclick="toggleGlobalSidebar()" style="background:transparent; border:none; color:inherit; cursor:pointer; padding:5px; margin-right:12px; display:inline-flex; align-items:center; border-radius: 8px; flex-shrink: 0;">
                <svg viewBox="0 0 24 24" fill="none" class="w-7 h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 26px; height: 26px;">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
        `;
        headerLeft.insertAdjacentHTML('afterbegin', hamburgerHtml);
    }

    // Logout handler
    window.handleGlobalLogout = () => {
        localStorage.clear();
        window.location.href = baseRoot + 'login.html';
    };

    // 6. Sidebar Logic
    window.toggleGlobalSidebar = () => {
        const overlay = document.getElementById('global-sidebar-overlay');
        const drawer = document.getElementById('global-side-drawer');
        const isOpen = drawer.style.display === 'flex';

        if (!isOpen) {
            overlay.style.display = 'block';
            drawer.style.display = 'flex';
            setTimeout(() => {
                overlay.classList.remove('hidden');
                overlay.classList.add('opacity-100');
                drawer.classList.remove('-translate-x-full');
            }, 10);
        } else {
            overlay.classList.remove('opacity-100');
            drawer.classList.add('-translate-x-full');
            setTimeout(() => {
                overlay.style.display = 'none';
                drawer.style.display = 'none';
            }, 300);
        }
    };

    window.refreshGlobalSidebar = () => {
        document.getElementById('global-sidebar-overlay')?.remove();
        document.getElementById('global-side-drawer')?.remove();
        initGlobalSidebar();
    };

    // Keyboard ESC shortcut
    if (!window._globalSidebarKeydownBound) {
        window._globalSidebarKeydownBound = true;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const drawer = document.getElementById('global-side-drawer');
                if (drawer && drawer.style.display === 'flex') {
                    toggleGlobalSidebar();
                } else {
                    const targetUrl = getMainMenuUrl();
                    if (!window.location.pathname.endsWith('menu.html') && !window.location.pathname.endsWith('flujos/index.html')) {
                        window.location.href = targetUrl;
                    }
                }
            }
        });
    }
}
initGlobalSidebar();

