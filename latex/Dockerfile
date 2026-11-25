# =========================================================================
# Dockerfile para compilação isolada do Protocolo de Survey em LaTeX
# =========================================================================
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Instala pacotes do TeX Live essenciais (incluindo abntex2, latexmk e ghostscript)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    lmodern \
    texlive-lang-portuguese \
    texlive-bibtex-extra \
    texlive-publishers \
    texlive-science \
    latexmk \
    make \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Comando padrão de compilação
CMD ["latexmk", "-pdf", "main.tex"]
