// public/produccion/js/etiquetas-zebra.js
// Reemplazo Web de BI8003ZP-ZEBRA.VBS + BI8003ZP-ZEBRA-LOGO.PS1 + VIETIQ-ZEBRA.VBS + VIMUESTROETIQ.VBS

const LOGO_VILLALBA_Z64 = ":Z64:eJx9k7FKA0EQQG9dwtnIRhCuyj9E7HMn+AGxSxP0E1IErwoeWNn4DYKNWFkGLZIQP8Ii4Q5sRSwPvLt1d+d2dyZFJiBMxt15byYbBDpYQINnO/lOXSxpHu7koqB5NKF5XNJ8VtFcNjRPp3vrbJuTnEuZEbw0pXhSEsBOXS/31aNpSgTiRhKB8Wa8IXhlTADTSUQEZCEaBMjqZacm+IXAAmEacCygihwDHuVqAkhANLoFxtcIPl9UGtHns5JuQNewgD6LBJi+W/g6y1XvcIvwFXvoBULNztME4RtHh6/dmd8AtPZ1aO0F4spCQlx9mr9uA1DxAnDSCTC42W2g7ew2wIGcW4EQRu8EhK23gALMzRRwY/mL8b3AosSYavLt//Uq+n17D7Pn2nt8X+Bwm+/AGzh4yYiHCwYCB2+PxXxdFvYidtxNhqvR0M6Bn/Wvy7v5qxVgp/1keH7ZtQLs67n4Xt/Pg+AWQFcnFx+r8UgJwAaeBoOHv/dD+hMyAje6/Y8L80hZjcJQo8jM0/WRmKfpQwn08q3/KIEY15VAhM8rAVzWk/4HaC4T6A==:30A2";
const LOGO_FABRICA_Z64  = ":Z64:eJxVj7ENwjAQRb/lIhQEU1iCwsoAmSCVZ6CkgB1SIIWCwquwBxJhE0ss4Yrg+zYF39I9nU737xvACv/69bbSV54rl1A41f49E+pVqO+RbDCSJiSyxZHs+qHY23Lg4Tvy6loyecMDo21oG70WYzU7JdTBI9Le8oAJDon2Djem3TOx5QMGrLHJPOS5GCbuQI30gI75v7lkbydFB9mOMtrmDChZUh6KTvC9yGM3iS54LqIPvg9oLIY=:EFB4";

export function buildOfficialVillalbaZpl({ codigo, serie, lote, fecha, desc1, desc2, material, condicion, pm }) {
    const cleanCodigo = (codigo || '4214731').replace(/-/g, '').trim();
    const cleanSerie  = (serie || 'BM0221').trim().toUpperCase();
    const cleanLote   = (lote || '2301328').trim();
    const cleanFecha  = (fecha || '06/11/2026').trim();
    const cleanDesc1  = (desc1 || 'IMPLANTE OSTEOSINTESIS VILLALBA').trim().toUpperCase().slice(0, 32);
    const cleanDesc2  = (desc2 || '').trim().toUpperCase().slice(0, 32);
    const cleanMat    = (material || 'TITANIO').trim().toUpperCase();
    const cleanCond   = (condicion || 'NO ESTERIL').trim().toUpperCase();
    const cleanPm     = (pm || 'PM 15').trim().toUpperCase();
    const leyendaEst  = cleanCond.includes('NO ESTERIL') ? 'ESTERILIZAR ANTES DE USAR' : 'ESTERILIZADO POR OXIDO DE ETILENO';

    return [
        '^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR4,4~SD15^LRN^CI27^XA',
        '^XA',
        '^MMT',
        '^PW799',
        '^LL0281',
        '^LS0',
        `^FO42,18^GFA,573,1280,16,${LOGO_VILLALBA_Z64}`,
        '^BY2,2,40^FT220,228^B3N,N,,N,N',
        `^FD${cleanSerie}^FS`,
        '^FT235,34^A0N,21,23^FH\\^FD                                   ^FS',
        `^FT235,57^A0N,21,23^FH\\^FD${cleanDesc1}^FS`,
        `^FT235,80^A0N,21,23^FH\\^FD ${cleanDesc2.padEnd(29, ' ')}^FS`,
        '^FT235,103^A0N,21,23^FH\\^FD                              ^FS',
        '^FT230,135^A0N,20,22^FH\\^FDCodigo:^FS',
        `^FT312,135^A0N,20,22^FH\\^FD${cleanCodigo}^FS`,
        '^FT230,159^A0N,20,22^FH\\^FDLote:^FS',
        `^FT313,159^A0N,20,22^FH\\^FD${cleanLote.padEnd(10, ' ')}^FS`,
        '^FT230,253^A0N,20,22^FH\\^FDSERIE:^FS',
        `^FT293,253^A0N,23,24^FH\\^FD${cleanSerie}^FS`,
        `^FT294,253^A0N,23,24^FH\\^FD${cleanSerie}^FS`,
        '^FT440,135^A0N,19,20^FH\\^FDFabricado:   ^FS',
        '^FT15,272^A0N,17,16^FH\\^FDIndustria Argentina^FS',
        '^FT15,185^A0N,17,16^FH\\^FDAutorizado por la ANMAT^FS',
        `^FT15,205^A0N,17,16^FH\\^FD${cleanPm.padEnd(13, ' ')}^FS`,
        '^FT15,125^A0N,17,16^FH\\^FDFabricado por VILLALBA S.A.       ^FS',
        '^FT15,145^A0N,17,16^FH\\^FDFray M.Esquiu 4548 - Caseros^FS',
        '^FT15,165^A0N,17,16^FH\\^FDBuenos Aires - Argentina^FS',
        '^FT15,228^A0N,20,14^FH\\^FDDT:Farm. Leandro A. Tagliabue    ^FS',
        '^FT15,252^A0N,20,14^FH\\^FDM.P.:18056^FS',
        `^FT230,183^A0N,18,20^FH\\^FD${cleanMat.padEnd(21, ' ')}^FS`,
        '^FO440,190^GB210,35,28^FS',
        `^FO448,198^A0N,27,40^FR^FH\\^FD${cleanCond.padEnd(13, ' ')}^FS`,
        `^FT548,135^A0N,20,22^FH\\^FD${cleanFecha}^FS`,
        `^FO420,238^A0N,16,20   ^FH\\^FD${leyendaEst}^FS`,
        `^FO440,138^GFA,249,328,8,${LOGO_FABRICA_Z64}`,
        '^FO185,260^A0N,16,20^FH\\^FD-Uso exclusivo a profesionales e instituciones ^FS',
        '^FO580,260^A0N,16,20   ^FH\\^FDsanitarias- ^FS',
        '^FO226,11^GB368,100,2^FS',
        '^FO635,18^BXN,3,200',
        `^FH\\^FD\\7E121${cleanSerie.padEnd(10, ' ')}\\7E110${cleanLote.padEnd(10, ' ')}\\7E117${cleanCodigo}^FS`,
        `^FT710,77^A0N,17,16^FH\\^FD(22)${cleanCodigo}^FS`,
        `^FT710,37^A0N,17,16^FH\\^FD(21)${cleanSerie}^FS`,
        `^FT710,57^A0N,17,16^FH\\^FD(10)${cleanLote.padEnd(10, ' ')}^FS`,
        '^PQ1,0,1,Y^XZ'
    ].join('\r\n');
}

document.addEventListener('DOMContentLoaded', () => {
    const inpCodigo = document.getElementById('zpl-codigo');
    const inpSerie  = document.getElementById('zpl-serie');
    const inpLote   = document.getElementById('zpl-lote');
    const inpFecha  = document.getElementById('zpl-fecha');
    const inpDesc1  = document.getElementById('zpl-desc1');
    const inpDesc2  = document.getElementById('zpl-desc2');
    const selMat    = document.getElementById('zpl-material');
    const selCond   = document.getElementById('zpl-condicion');
    const inpPm     = document.getElementById('zpl-pm');
    const zplEditor = document.getElementById('zpl-raw-editor');
    const previewImg = document.getElementById('label-preview-img');
    const statusEl  = document.getElementById('render-status');

    // Leer parámetros si viene desde Órdenes de Producción (VIAORD)
    const params = new URLSearchParams(window.location.search);
    if (params.get('codigo')) inpCodigo.value = params.get('codigo').replace(/-/g, '');
    if (params.get('lote'))   inpLote.value   = params.get('lote');
    if (params.get('serie'))  inpSerie.value  = params.get('serie');
    if (params.get('desc')) {
        const fullDesc = params.get('desc').toUpperCase();
        inpDesc1.value = fullDesc.slice(0, 30);
        inpDesc2.value = fullDesc.slice(30, 60);
    }
    if (params.get('material')) {
        const m = params.get('material').toUpperCase();
        if (m.includes('TITANIO')) selMat.value = 'TITANIO';
        else if (m.includes('ACERO')) selMat.value = 'ACERO INOX.';
        else if (m.includes('POLIET')) selMat.value = 'PEEK / UHMWPE';
    }

    let currentBlobUrl = null;

    async function renderZplPreview(useEditorText = false) {
        const zpl = useEditorText ? zplEditor.value : buildOfficialVillalbaZpl({
            codigo: inpCodigo.value,
            serie: inpSerie.value,
            lote: inpLote.value,
            fecha: inpFecha.value,
            desc1: inpDesc1.value,
            desc2: inpDesc2.value,
            material: selMat.value,
            condicion: selCond.value,
            pm: inpPm.value
        });

        if (!useEditorText) {
            zplEditor.value = zpl;
        }

        statusEl.textContent = 'Renderizando etiqueta con motor Labelary (8dpmm / 4x1.5")...';
        statusEl.className = 'text-[11px] text-amber-500 font-bold';

        try {
            const response = await fetch('https://api.labelary.com/v1/printers/8dpmm/labels/4x1.5/0/', {
                method: 'POST',
                headers: {
                    'Accept': 'image/png',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: zpl
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = URL.createObjectURL(blob);
            previewImg.src = currentBlobUrl;
            statusEl.textContent = `Etiqueta generada en vivo (${(blob.size / 1024).toFixed(1)} KB) — Lista para Zebra`;
            statusEl.className = 'text-[11px] text-emerald-500 font-bold';
        } catch (err) {
            console.warn('Labelary API offline o bloqueada, mostrando LOGONEW.PNG local:', err);
            statusEl.textContent = 'Modo Offline: Mostrando última LOGONEW.PNG de planta (ZPL actualizado listo para descargar/imprimir)';
            statusEl.className = 'text-[11px] text-blue-400 font-bold';
        }
    }

    document.getElementById('btn-render-label')?.addEventListener('click', () => renderZplPreview(false));

    // Auto-update ZPL cuando cambian los inputs
    [inpCodigo, inpSerie, inpLote, inpFecha, inpDesc1, inpDesc2, selMat, selCond, inpPm].forEach(el => {
        el?.addEventListener('input', () => {
            zplEditor.value = buildOfficialVillalbaZpl({
                codigo: inpCodigo.value,
                serie: inpSerie.value,
                lote: inpLote.value,
                fecha: inpFecha.value,
                desc1: inpDesc1.value,
                desc2: inpDesc2.value,
                material: selMat.value,
                condicion: selCond.value,
                pm: inpPm.value
            });
        });
    });

    document.getElementById('btn-download-zpl')?.addEventListener('click', () => {
        const blob = new Blob([zplEditor.value], { type: 'text/plain;charset=ascii' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `LOGONEW_${inpSerie.value || 'ZEBRA'}.TXT`;
        a.click();
    });

    document.getElementById('btn-download-png')?.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = previewImg.src;
        a.download = `LOGONEW_${inpSerie.value || 'ZEBRA'}.PNG`;
        a.click();
    });

    document.getElementById('btn-copy-zpl')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(zplEditor.value);
        statusEl.textContent = '¡Código ZPL copiado al portapapeles!';
    });

    document.getElementById('btn-print-label')?.addEventListener('click', () => {
        const win = window.open('', '_blank', 'width=600,height=350');
        win.document.write(`
            <html><head><title>Imprimir Etiqueta Zebra 4x1.5</title>
            <style>@page { size: 4in 1.5in; margin: 0; } body { margin: 0; display: flex; justify-content: center; align-items: center; } img { width: 100%; height: auto; }</style>
            </head><body onload="window.print();"><img src="${previewImg.src}" /></body></html>
        `);
        win.document.close();
    });

    renderZplPreview(false);
});
