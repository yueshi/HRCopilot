// pdf-parse 类型声明
declare module 'pdf-parse' {
  interface PDFParseData {
    text: string;
    numpages: number;
    info?: {
      Title?: string;
      Author?: string;
      Subject?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
    };
    creationDate?: Date;
    modificationDate?: Date;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PDFParseData>;

  export = pdfParse;
}
