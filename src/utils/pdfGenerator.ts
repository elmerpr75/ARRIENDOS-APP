import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export async function downloadElementAsPdf(
  elementId: string,
  filename: string,
  onProgress?: (isGenerating: boolean) => void
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return false;
  }

  try {
    if (onProgress) onProgress(true);

    const fullHeight = Math.max(element.scrollHeight, element.offsetHeight, 1100);
    const fullWidth = Math.max(element.scrollWidth, element.offsetWidth, 900);

    const canvas = await html2canvas(element, {
      scale: 2, // High resolution for crisp text
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(fullWidth, 1200),
      windowHeight: fullHeight + 400,
      height: fullHeight,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.height = 'auto';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.backgroundColor = '#ffffff';
          clonedElement.style.width = '100%';

          // Remove clipping and overflow restrictions from all parent containers
          let parent = clonedElement.parentElement;
          while (parent && parent !== clonedDoc.body) {
            parent.style.maxHeight = 'none';
            parent.style.height = 'auto';
            parent.style.overflow = 'visible';
            parent.style.position = 'static';
            parent.style.transform = 'none';
            parent = parent.parentElement;
          }

          if (clonedDoc.body) {
            clonedDoc.body.style.maxHeight = 'none';
            clonedDoc.body.style.height = 'auto';
            clonedDoc.body.style.overflow = 'visible';
          }
          if (clonedDoc.documentElement) {
            clonedDoc.documentElement.style.maxHeight = 'none';
            clonedDoc.documentElement.style.height = 'auto';
            clonedDoc.documentElement.style.overflow = 'visible';
          }

          // Hide UI-only elements in clone
          clonedDoc.querySelectorAll('.no-print').forEach((node) => {
            (node as HTMLElement).style.display = 'none';
          });
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 8; // 8mm margins
    const printableWidth = pageWidth - margin * 2; // 194mm
    const printableHeight = pageHeight - margin * 2; // 281mm

    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * printableWidth) / canvas.width;

    // Single-page auto-fit for invoices and receipts within 1.3x single A4 page
    if (imgHeight <= printableHeight * 1.3) {
      const scale = Math.min(1, printableHeight / imgHeight);
      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;
      const xOffset = margin + (printableWidth - finalWidth) / 2;
      const yOffset = margin;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');
    } else {
      // Multi-page document (such as executive status reports with dozens of rows)
      let heightLeft = imgHeight;
      let pageIndex = 0;

      while (heightLeft > 0) {
        if (pageIndex > 0) {
          pdf.addPage();
        }
        const position = margin - (pageIndex * printableHeight);
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= printableHeight;
        pageIndex++;
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  } finally {
    if (onProgress) onProgress(false);
  }
}

export function printElementSafely(elementId: string, fallbackFilename: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with id ${elementId} not found for printing`);
    try {
      window.print();
    } catch {
      // ignore
    }
    return;
  }

  // Collect all stylesheets (link tags and style tags) from current document
  let stylesHtml = '';
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    stylesHtml += link.outerHTML + '\n';
  });
  document.querySelectorAll('style').forEach((styleTag) => {
    stylesHtml += styleTag.outerHTML + '\n';
  });

  // Clone element to clean up any unwanted classes or display issues
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.overflow = 'visible';
  clone.style.maxHeight = 'none';
  clone.style.height = 'auto';

  // Remove any no-print controls from clone
  clone.querySelectorAll('.no-print').forEach((node) => node.remove());

  const docTitle = fallbackFilename.replace(/[-_]/g, ' ');

  const printableHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${docTitle}</title>
  ${stylesHtml}
  <style>
    @page {
      size: letter portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    .no-print {
      display: none !important;
    }
    .print-doc-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px 20px;
      background: #ffffff;
      color: #0f172a;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    tr, td, th {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    img {
      max-width: 100% !important;
    }
  </style>
</head>
<body class="bg-white text-slate-900">
  <div class="no-print" style="position: sticky; top: 0; background: #0f172a; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.25); font-family: system-ui, -apple-system, sans-serif;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 18px;">🖨️</span>
      <div>
        <div style="font-weight: 700; font-size: 14px; line-height: 1.2;">Documento listo para imprimir</div>
        <div style="font-size: 11px; color: #94a3b8;">${docTitle}</div>
      </div>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        <span>🖨️</span> Imprimir Ahora
      </button>
      <button onclick="window.close()" style="background: #334155; color: #e2e8f0; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
        Cerrar Ventana
      </button>
    </div>
  </div>
  <div class="print-doc-container">
    ${clone.outerHTML}
  </div>
</body>
</html>`;

  // Strategy 1: Open a dedicated Print Window
  // Synchronous call within user click event ensures window.open is allowed by browsers
  let printWin: Window | null = null;
  try {
    printWin = window.open('', '_blank', 'width=980,height=880,menubar=no,toolbar=no,location=no,status=no');
  } catch (err) {
    printWin = null;
  }

  if (printWin && !printWin.closed) {
    try {
      printWin.document.open();
      printWin.document.write(printableHtml);
      printWin.document.close();

      const triggerPrint = () => {
        try {
          printWin?.focus();
          printWin?.print();
        } catch (e) {
          console.warn('Error invoking print on new window:', e);
        }
      };

      if (printWin.document.readyState === 'complete') {
        setTimeout(triggerPrint, 250);
      } else {
        printWin.onload = () => setTimeout(triggerPrint, 250);
      }
      return;
    } catch (popupErr) {
      console.warn('Could not populate popup print window, falling back:', popupErr);
      try {
        printWin.close();
      } catch {}
    }
  }

  // Strategy 2: Isolated hidden iframe print
  // Used if popup windows are restricted (e.g. inside an iframe preview)
  try {
    const existingFrame = document.getElementById('app-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'app-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '1000px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(printableHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (iframeErr) {
          console.warn('iframe.print failed, falling back to window.print():', iframeErr);
          window.print();
        }
        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 40000);
      }, 300);
      return;
    }
  } catch (iframeErr) {
    console.warn('Iframe print setup error:', iframeErr);
  }

  // Strategy 3: Standard window.print fallback
  try {
    document.body.classList.add('is-printing-document');
    element.classList.add('current-print-target');
    const handleAfterPrint = () => {
      document.body.classList.remove('is-printing-document');
      element.classList.remove('current-print-target');
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    window.print();
  } catch (printErr) {
    console.warn('window.print failed, falling back to PDF download:', printErr);
    downloadElementAsPdf(elementId, fallbackFilename);
  }
}

export function openExternalUrl(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
