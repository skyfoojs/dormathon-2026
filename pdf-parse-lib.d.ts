// pdf-parse's package root (index.js) has a broken self-test check that
// misfires under bundlers (see lib/ai/sources/moh.ts), so that file is
// imported from its inner module instead, which @types/pdf-parse doesn't
// cover - same shape, just repointed here.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
