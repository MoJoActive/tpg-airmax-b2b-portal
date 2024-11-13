declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type: string; quality: number };
    html2canvas?: { scale?: number };
    jsPDF?: { unit?: string; format?: string | number[]; orientation?: string };
  }

  function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Promise<void>;

  export = html2pdf;
}
