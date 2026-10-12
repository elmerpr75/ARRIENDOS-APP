import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/**
 * Recursively replicates all computed layout, typography, box-model, and color styles
 * from the live DOM element into its clone. This bypasses all issues with external
 * stylesheets, modern CSS syntax (oklch), missing stylesheets in cloned iframes,
 * and ensures 100% faithful visual reproduction in html2canvas.
 */
function recursivelyApplyComputedStyles(source: HTMLElement, target: HTMLElement): void {
  try {
    const cs = window.getComputedStyle(source);

    // Structural & layout
    target.style.display = cs.display;
    if (cs.display.includes('flex')) {
      target.style.flexDirection = cs.flexDirection;
      target.style.flexWrap = cs.flexWrap;
      target.style.alignItems = cs.alignItems;
      target.style.justifyContent = cs.justifyContent;
      target.style.gap = cs.gap;
    }
    if (cs.display.includes('grid')) {
      target.style.gridTemplateColumns = cs.gridTemplateColumns;
      target.style.gridTemplateRows = cs.gridTemplateRows;
      target.style.gap = cs.gap;
    }
    if (cs.display.includes('table')) {
      target.style.borderCollapse = cs.borderCollapse;
    }

    // Box model & dimensions
    target.style.boxSizing = cs.boxSizing;
    target.style.width = cs.width;
    target.style.minWidth = cs.minWidth;
    target.style.maxWidth = cs.maxWidth;
    target.style.paddingTop = cs.paddingTop;
    target.style.paddingRight = cs.paddingRight;
    target.style.paddingBottom = cs.paddingBottom;
    target.style.paddingLeft = cs.paddingLeft;
    target.style.marginTop = cs.marginTop;
    target.style.marginRight = cs.marginRight;
    target.style.marginBottom = cs.marginBottom;
    target.style.marginLeft = cs.marginLeft;

    // Typography
    target.style.color = cs.color;
    target.style.fontFamily = cs.fontFamily;
    target.style.fontSize = cs.fontSize;
    target.style.fontWeight = cs.fontWeight;
    target.style.lineHeight = cs.lineHeight;
    target.style.letterSpacing = cs.letterSpacing;
    target.style.textAlign = cs.textAlign;
    target.style.textTransform = cs.textTransform;

    // Background & Borders
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      target.style.backgroundColor = cs.backgroundColor;
    }
    if (cs.borderTopWidth && cs.borderTopWidth !== '0px') {
      target.style.borderTop = `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`;
    }
    if (cs.borderRightWidth && cs.borderRightWidth !== '0px') {
      target.style.borderRight = `${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}`;
    }
    if (cs.borderBottomWidth && cs.borderBottomWidth !== '0px') {
      target.style.borderBottom = `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`;
    }
    if (cs.borderLeftWidth && cs.borderLeftWidth !== '0px') {
      target.style.borderLeft = `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`;
    }
    if (cs.borderRadius && cs.borderRadius !== '0px') {
      target.style.borderRadius = cs.borderRadius;
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      target.style.boxShadow = cs.boxShadow;
    }
  } catch (err) {
    // Graceful skip for elements with restricted styles
  }

  // Recurse cleanly down child elements
  const sourceChildren = Array.from(source.children) as HTMLElement[];
  const targetChildren = Array.from(target.children) as HTMLElement[];
  const minLen = Math.min(sourceChildren.length, targetChildren.length);
  for (let i = 0; i < minLen; i++) {
    if (sourceChildren[i] && targetChildren[i] && sourceChildren[i].nodeType === 1 && targetChildren[i].nodeType === 1) {
      recursivelyApplyComputedStyles(sourceChildren[i], targetChildren[i]);
    }
  }
}

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

    // Extract inlined stylesheet rules from all currently loaded stylesheets
    let combinedCssText = '';
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) {
            for (const rule of Array.from(sheet.cssRules)) {
              combinedCssText += rule.cssText + '\n';
            }
          }
        } catch {
          // Cross-origin stylesheet rules access restriction
        }
      }
    } catch {
      // Ignore
    }

    const fullHeight = Math.max(element.scrollHeight, element.offsetHeight, 1100);
    const fullWidth = Math.max(element.scrollWidth, element.offsetWidth, 850);

    const canvas = await html2canvas(element, {
      scale: 2, // High resolution for ultra-sharp vectors and text
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(fullWidth, 1100),
      windowHeight: fullHeight + 300,
      height: fullHeight,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // Remove UI-only elements before styling so node hierarchy matches
          clonedElement.querySelectorAll('.no-print').forEach((node) => {
            (node as HTMLElement).remove();
          });

          // Inject combined document CSS directly into cloned <head>
          if (combinedCssText) {
            const inlineStyleTag = clonedDoc.createElement('style');
            inlineStyleTag.setAttribute('type', 'text/css');
            inlineStyleTag.textContent = combinedCssText;
            clonedDoc.head.appendChild(inlineStyleTag);
          }

          // Ensure document layout is pristine, white background, and unclipped
          clonedElement.classList.remove('hidden');
          clonedElement.style.display = 'block';
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.height = 'auto';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.backgroundColor = '#ffffff';
          clonedElement.style.color = '#0f172a';
          clonedElement.style.width = '100%';
          clonedElement.style.maxWidth = '900px';
          clonedElement.style.margin = '0 auto';
          clonedElement.style.padding = '24px 32px';

          // Recursively apply all computed layout and visual styles
          recursivelyApplyComputedStyles(element, clonedElement);

          // Clear any clipping from parent tree
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
            clonedDoc.body.style.backgroundColor = '#ffffff';
          }
          if (clonedDoc.documentElement) {
            clonedDoc.documentElement.style.maxHeight = 'none';
            clonedDoc.documentElement.style.height = 'auto';
            clonedDoc.documentElement.style.overflow = 'visible';
          }
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

    // Single-page auto-fit for invoices and receipts within 1.35x single A4 page
    if (imgHeight <= printableHeight * 1.35) {
      const scale = Math.min(1, printableHeight / imgHeight);
      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;
      const xOffset = margin + (printableWidth - finalWidth) / 2;
      const yOffset = margin;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');
    } else {
      // Multi-page document
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

  // Collect all stylesheets (link tags, style tags, and extracted css rules)
  let stylesHtml = '';
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    stylesHtml += link.outerHTML + '\n';
  });
  document.querySelectorAll('style').forEach((styleTag) => {
    stylesHtml += styleTag.outerHTML + '\n';
  });

  // Extract loaded CSS rules directly into an inline style tag
  let extractedCss = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          for (const rule of Array.from(sheet.cssRules)) {
            extractedCss += rule.cssText + '\n';
          }
        }
      } catch {}
    }
  } catch {}
  if (extractedCss) {
    stylesHtml += `<style type="text/css">${extractedCss}</style>\n`;
  }

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
