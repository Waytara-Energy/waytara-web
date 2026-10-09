import { Image } from "@react-pdf/renderer";
import { PDF_LOGO_ASPECT, PDF_LOGO_SRC } from "./pdf-logo";

/** The WayTara logo for the top left of a PDF page (react-pdf's own Image, not an HTML img, so it has no alt text). */
export function PdfLogo({ height = 30 }: { height?: number }) {
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={PDF_LOGO_SRC} style={{ height, width: height * PDF_LOGO_ASPECT, marginBottom: 4 }} />;
}
