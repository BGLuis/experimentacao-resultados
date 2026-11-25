# Configuração do latexmk para compilação com PDFLaTeX e BibTeX
$pdf_mode = 1;
$postscript_mode = 0;
$dvi_mode = 0;

$pdflatex = 'pdflatex -synctex=1 -interaction=nonstopmode -file-line-error %O %S';
$bibtex = 'bibtex %O %B';

# Extensões adicionais para limpeza com 'latexmk -c'
$clean_ext .= ' %R.synctex.gz %R.bbl %R.brf %R.nav %R.snm %R.vrb %R.fls %R.fdb_latexmk';
