# TERIAN ERP v3.0 — Sistema Industrial Unificado (COBOL WSFESA + Web)

Repositorio de pruebas del sistema unificado de **Villalba Hnos. Implantes S.A.** (`santpro80/svdepruebas`).

## 📦Los 6 Módulos Unificados en `public/`

1. **`TZ` — Trazabilidad de Cajas Quirúrgicas (`public/supervisor/`, `public/operario/`, `public/mantenimiento/`)**
   - Control de cajas quirúrgicas por código y serie (`AX2066`, `AX2052`, `BD6590`), 388 modelos 3D `.glb` y 480 fotos `.webp`.
2. **`DP` — Depósito Industrial & 4 Almacenes (`public/deposito/`)**
   - Materia Prima, Semi-Elaborado, No Estéril Terminado y Estéril Terminado.
3. **`PR` — Producción, Órdenes de Producción, Cuarentena & Etiquetas Zebra (`public/produccion/`)**
   - Tablero `VIAORD` (`OP #26896`) con integración a Monday.com (`#9012338710`), Cuarentena de Calidad (`VIAPIE` / `PZ3`) y Estudio de Etiquetas Zebra ZPL + GS1 DataMatrix + Labelary (`BI8003ZP-ZEBRA` / `VIETIQ-ZEBRA`).
4. **`CM` — Comercial, Préstamos Multi-Sucursal, Facturación AFIP & ANMAT (`public/comercial/`)**
   - Remitos y Préstamos Quirúrgicos (`VI0201N2` / `VIA34/35` / `INTEGRA_CHECK` / `ENVIOS.TXT`) en las 11 sucursales (`.04` Caseros a `.26` Córdoba).
   - Facturación Electrónica AFIP/ARCA (`WSFEv1`), QR Oficial Base64 (`ARCHI-QR.TXT`), Transparencia Fiscal Ley 27.743, Cuentas Corrientes (`VIA13/23`) y Trazabilidad ANMAT / GCBA (`CABA-PRD`).
   - Maestros unificados de Clientes (`VIA02`), Médicos Cirujanos (`VIA38`), Proveedores (`VIA44`), Sucursales (`VIA47`) y Normalizador Geográfico Oficial **Georef AR** (`apis.datos.gob.ar/georef`).
5. **`PD` — Pedidos Internos & Órdenes de Compra Industriales (`public/pedidos-internos/`)**
   - Unificación de `PEDIDOS DE COMPRA` (React) + `pedidos-internos` + Órdenes de Compra a Proveedores (`VIA44` / `VIA60`).
6. **`FL` — Flujos Operativos & Centro de Control ERP (`public/flujos/`, `public/sincronizador-erp.html`)**
   - Diagramas interactivos y Centro de Sincronización Bidireccional COBOL ↔ Web.

## 🚀 Cómo probar localmente en 1 clic

Ejecutar `INICIAR-TERIAN-ERP.bat` o desde terminal:

```bash
cd public
npx http-server -p 8090 -c-1
```

Y abrir en el navegador: `http://localhost:8090/sincronizador-erp.html`
